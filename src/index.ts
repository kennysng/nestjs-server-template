import type { DoneCallback, Job } from 'bee-queue';
import type { FastifyBaseLogger } from 'fastify';

import compression from '@fastify/compress';
import helmet from '@fastify/helmet';
import { fastifyJwt } from '@fastify/jwt';
import Queue = require('bee-queue');
import * as _cluster from 'cluster';
import fastify from 'fastify';
import { readFile } from 'fs/promises';
import { InternalServerError, NotFound, RequestTimeout } from 'http-errors';
import httpErrors = require('http-errors');
import yaml = require('js-yaml');
import uniq = require('lodash.uniq');
import minimist = require('minimist');
import { match } from 'node-match-path';
import { cpus } from 'os';
import { resolve } from 'path';
import { URL } from 'url';

import daos from './dao';
import { DaoHelper } from './dao/base';
import {
  Dependencies,
  IConfig,
  IMapper,
  IMasterConfig,
  IRequest,
  IResult,
  IUser,
  IWorkerConfig,
} from './interface';
import { ServerType } from './interface';
import logger from './logger';
import * as middlewares_ from './middleware';
import { logSection } from './utils';
import { connect as connectDB } from './sequelize';

const cluster = _cluster as unknown as _cluster.Cluster;

const argv = minimist(process.argv.slice(2));

const NODE_ENV = (process.env.NODE_ENV =
  argv.env || argv.E || process.env.NODE_ENV || 'development');

const queues: Record<'server' | 'worker', Record<string, Queue>> = {
  server: {},
  worker: {},
};

function connectQueue(
  type: 'server' | 'worker',
  key: string,
  redisConfig: any,
  logger: FastifyBaseLogger,
) {
  let queue = queues[type][key];
  if (!queue) {
    queue = queues[type][key] = new Queue(key, {
      isWorker: type === 'worker',
      redis: redisConfig,
    });
    logger.info(`Queue '${key}' connecting ...`);
    queue.on('ready', () => logger.info(`Queue '${key}' is ready`));
  }
  return queue;
}

function wait<T>(queue: Queue, job: Job<T>, timeout: number) {
  const start = Date.now();
  return new Promise<IResult>((resolve, reject) => {
    const timer = setTimeout(async () => {
      queue.removeJob(job.id);
      reject(new RequestTimeout());
    }, timeout);
    job.on('succeeded', (result: IResult) => {
      clearTimeout(timer);
      resolve({ ...result, elapsed: Date.now() - start });
    });
    job.on('failed', (e) =>
      reject(httpErrors[e.message] ? new httpErrors[e.message]() : e),
    );
  });
}

function masterMain(config: IMasterConfig) {
  logSection('Initialize Server', logger('Server'), async () => {
    const port = config.port || 8080;
    const redisConfig = config.redis || {};

    const mapperPath = resolve(__dirname, 'mapper.json');
    const content = await readFile(mapperPath, 'utf8');
    const mapper = JSON.parse(content) as IMapper[];

    const app = fastify({ logger: true });
    app.register(helmet);
    app.register(compression);

    if (!config.auth.access_token.secret) {
      throw new InternalServerError('Missing Secret for Access Token');
    }

    app.register(fastifyJwt, {
      secret: config.auth.access_token.secret,
    });

    // health check
    app.get('/health', async (request) => {
      const keys = uniq(mapper.map((m) => m.queue));
      return {
        statusCode: 200,
        message: 'OK',
        result: await Promise.all(
          keys.map<Promise<IResult>>(async (key) => {
            let job: Job<IRequest>;
            try {
              const queue = connectQueue(
                'server',
                key,
                redisConfig,
                request.log,
              );
              const data: IRequest = {
                method: 'HEALTH',
                url: '',
                headers: request.headers,
                query: {},
                params: {},
              };
              job = await queue.createJob(data).save();
              const result = await wait(queue, job, 10 * 1000); // timeout if cannot return within 10s
              return { ...result, result: { queue: key } };
            } catch (e) {
              return {
                statusCode: e.statusCode || 500,
                message: e.message,
                result: { queue: key },
              };
            }
          }),
        ),
      };
    });

    // RESTful api call
    app.all('*', async (request, reply) => {
      let job: Job<IRequest>;
      try {
        const url = new URL(request.url, `http://localhost:${port}`);
        for (const { path, before = [], after = [], queue: key } of mapper) {
          const { matches } = match(path, url.pathname);
          if (matches) {
            const queue = connectQueue('server', key, redisConfig, request.log);
            let data = {
              method: request.method,
              url: request.url,
              headers: request.headers,
              query: request.query,
              params: request.params,
              body: request.body,
              user: request.user as IUser,
            };
            for (const middleware of before) {
              data =
                (await middlewares_[middleware]({
                  config,
                  request,
                  reply,
                  jobData: data,
                })) || data;
            }
            job = await queue.createJob(data).save();
            let result = await wait<IRequest>(
              queue,
              job,
              config.timeout || 30 * 1000,
            );
            for (const middleware of after) {
              result =
                (await middlewares_[middleware]({
                  config,
                  request,
                  reply,
                  jobData: data,
                  result,
                })) || result;
            }
            return result;
          }
        }
        throw new NotFound('Page Not Found');
      } catch (e) {
        return {
          statusCode: e.statusCode || 500,
          message: e.message,
        };
      }
    });

    process.on('beforeExit', () => {
      Promise.allSettled([
        ...Object.values(queues.server).map((q) => q.close()),
        ...Object.values(queues.worker).map((q) => q.close()),
      ]);
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
      config.modules.map((key) =>
        import(resolve(__dirname, 'queue', key)).then(
          async ({ default: module }) => {
            const queue = await connectQueue(
              'worker',
              key,
              redisConfig,
              myLogger,
            );
            const queueInst = new module(config, dependencies);
            return queue.process(
              (job: Job<IRequest>, done: DoneCallback<IResult>) => {
                myLogger.info(job.data);
                queueInst
                  .run(job.data)
                  .then((result) => done(null, result))
                  .catch((e) => {
                    myLogger.error(e, e.message);
                    done(e.statusCode ? new Error(e.statusCode) : e);
                  });
              },
            );
          },
        ),
      ),
    );
  });
}

async function main() {
  const content = await readFile(
    resolve('configs', `config.${NODE_ENV}.yaml`),
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
    case 'port' in config && 'modules' in config: {
      serverType = ServerType.HYBRID;
      break;
    }
    case 'port' in config: {
      serverType = ServerType.MASTER;
      break;
    }
    case 'modules' in config: {
      serverType = ServerType.WORKER;
      break;
    }
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
