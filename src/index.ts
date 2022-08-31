import type { DoneCallback, Job } from 'bee-queue';

import compression from '@fastify/compress';
import helmet from '@fastify/helmet';
import * as _cluster from 'cluster';
import fastify, { FastifyPluginCallback } from 'fastify';
import { readFile } from 'fs/promises';
import httpStatus = require('http-status');
import yaml = require('js-yaml');
import uniq = require('lodash.uniq');
import minimist = require('minimist');
import { cpus } from 'os';
import { resolve } from 'path';

import daos from './dao';
import { DaoHelper } from './dao/base';
import {
  Dependencies,
  HttpMethods,
  IBodyRequest,
  IConfig,
  IError,
  IMasterConfig,
  IRequest,
  IResponse,
  IResult,
  IWorkerConfig,
} from './interface';
import { ServerType } from './interface';
import logger from './logger';
import { connect as connectDB } from './sequelize';
import { applyCache, connectQueue, logSection, wait } from './utils';
import RateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';

const cluster = _cluster as unknown as _cluster.Cluster;

const base = true;

const argv = minimist(process.argv.slice(2));

const NODE_ENV = (process.env.NODE_ENV =
  argv.env || argv.E || process.env.NODE_ENV || 'development');

function masterMain(config: IMasterConfig) {
  logSection('Initialize Server', logger('Server'), async () => {
    const port = (config.port = config.port || 8080);
    const redisConfig = (config.redis = config.redis || {});
    const mapper = (config.mapper = config.mapper || []);

    const app = fastify({ logger: true });

    app.register(helmet);
    app.register(compression);

    // rate limit
    if (config.limit) {
      app.register(RateLimit, {
        max: config.limit.count,
        timeWindow: config.limit.window,
        keyGenerator: (req) =>
          (req.headers['x-real-ip'] as string) || // nginx
          (req.headers['x-client-ip'] as string) || // apache
          req.ip,
        skipOnError: true,
        redis: new Redis(redisConfig),
      });
    }

    // custom plugins
    const plugins: FastifyPluginCallback[] = (await import('./plugin')).default;
    for (const plugin of plugins) app.register(plugin, config);

    // error handling
    app.setErrorHandler((e, req, res) => {
      const statusCode = e.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
      const result: IError = {
        statusCode,
        error: e.message,
        extra: e['extra'],
      };
      if (NODE_ENV === 'development') {
        result.stack = e.stack;
      }

      res.status(statusCode);
      res.send(result);
    });

    // health check
    app.get('/health', async (req, res): Promise<IResponse> => {
      // no cache
      res.header('cache-control', 'no-cache, no-store');

      const keys = uniq(mapper.map((m) => m.queue));
      let statusCode = httpStatus.OK;
      const result = await Promise.all(
        keys.map<Promise<IResponse>>(async (key) => {
          const start = Date.now();
          const queue = connectQueue('server', key, redisConfig, req.log);
          const data: IRequest = {
            method: 'HEALTH',
            url: '*',
            headers: req.headers,
            query: req.query,
            params: req.params,
            user: req.user,
            extra: req.extra,
          };
          const job: Job<IRequest> = await queue.createJob(data).save();
          const result = await wait(queue, job, 3 * 1000); // healthy server can return within 3 seconds
          return {
            ...result,
            queue: key,
            elapsed: Date.now() - start,
          };
        }),
      );
      const unavailable = result.find((r) => r.statusCode !== httpStatus.OK);
      if (unavailable) statusCode = httpStatus.SERVICE_UNAVAILABLE;
      res.status(statusCode);
      return unavailable
        ? /* eslint-disable */ {
          statusCode,
          error: httpStatus['503_NAME'],
        }
        : {
          statusCode,
          result,
        }; /* eslint-enable */

    });

    // RESTful api call
    app.all('*', async (req, res): Promise<IResponse> => {
      // default cache
      if (config.cache) applyCache(res, config.cache);

      const data: IRequest = {
        method: req.method as HttpMethods,
        url: req.url,
        headers: req.headers,
        query: req.query,
        params: req.params,
        user: req.user,
        extra: req.extra,
      };

      const queue = connectQueue(
        'server',
        req.mapper.queue,
        redisConfig,
        req.log,
      );
      if (['POST', 'PUT', 'PATCH'].indexOf(req.method) > -1) {
        (data as IBodyRequest).body = req.body;
      }
      const job: Job<IRequest> = await queue.createJob(data).save();
      const result = await wait<IRequest>(
        queue,
        job,
        config.timeout || 30 * 1000,
      );
      res.status(result.statusCode);

      if ('cache' in result) {
        applyCache(res, result.cache);
        delete result.cache;
      }

      return result;
    });

    await app.listen({ host: '0.0.0.0', port });
  });
}

function workerMain(config: IWorkerConfig) {
  const myLogger = logger('Worker');
  logSection('Initialize Worker', myLogger, async () => {
    const redisConfig = config.redis || {};

    const dependencies = new Dependencies();

    if (config.database) {
      const sequelize = await connectDB(config);
      dependencies.register(sequelize); // Sequelize

      const daoHelper = new DaoHelper(sequelize);
      for (const [daoClass, customDao, options] of daos) {
        daoHelper.register(
          daoClass,
          new customDao(sequelize, daoHelper, options),
        );
      }
      dependencies.register(daoHelper); // DaoHelper
    }

    const dependencies_ = require('./dependency') || {};
    await Promise.all(
      Object.keys(dependencies_).map(async (key) => {
        dependencies.register(await dependencies_[key](config));
      }),
    );

    Promise.all(
      config.modules.map((key) => {
        const queueLogger = logger(`Queue:${key}`);
        return import(resolve(__dirname, 'queue', key)).then(
          async ({ default: module }) => {
            const queue = await connectQueue(
              'worker',
              key,
              redisConfig,
              queueLogger,
            );
            const queueInst = new module(config, dependencies);
            return queue.process(
              (job: Job<IRequest>, done: DoneCallback<IResult>) => {
                queueLogger.info(job.data);
                queueInst
                  .run(job.data)
                  .then((result) => done(null, result))
                  .catch((e) => {
                    queueLogger.error(e, e.message);
                    done(e.statusCode ? new Error(e.statusCode) : e);
                  });
              },
            );
          },
        );
      }),
    );
  });
}

async function main() {
  const content = await readFile(
    resolve(base ? 'templates' : 'configs', `config.${NODE_ENV}.yaml`),
    'utf8',
  );
  const config = yaml.load(content) as IConfig;
  let clusters: number;
  if (config.clusters === true) {
    clusters = cpus().length;
  } else if (config.clusters === false) {
    clusters = 0;
  } else {
    clusters = config.clusters;
  }

  let serverType: ServerType;
  switch (true) {
    case 'port' in config && 'modules' in config:
      serverType = ServerType.HYBRID;
      break;
    case 'port' in config:
      serverType = ServerType.MASTER;
      break;
    case 'modules' in config:
      serverType = ServerType.WORKER;
      break;
  }

  if (!clusters) {
    if (serverType !== ServerType.WORKER) {
      masterMain(config as IMasterConfig);
    }
    if (serverType !== ServerType.MASTER) {
      workerMain(config as IWorkerConfig);
    }
    return;
  }

  if (cluster.isPrimary) {
    for (let i = 0; i < clusters; i++) {
      cluster.fork();
    }
    if (serverType === ServerType.HYBRID) {
      masterMain(config as IMasterConfig);
    }
  } else if (serverType === ServerType.MASTER) {
    masterMain(config as IMasterConfig);
  } else {
    workerMain(config as IWorkerConfig);
  }
}

main();
