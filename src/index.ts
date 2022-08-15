import compression from '@fastify/compress';
import helmet from '@fastify/helmet';
import Queue = require('bee-queue');
import fastify from 'fastify';
import { readFile } from 'fs/promises';
import { NotFound, RequestTimeout } from 'http-errors';
import yaml = require('js-yaml');
import minimist = require('minimist');
import { resolve } from 'path';
import {
  Dependencies,
  IConfig,
  IMapper,
  IMasterConfig,
  IResult,
  IWorkerConfig,
} from './interface';
import { ServerType } from './interface';
import { match } from 'node-match-path';
import { URL } from 'url';
import * as _cluster from 'cluster';
import { cpus } from 'os';
import pino from 'pino';
import * as dependencies_ from './dependencies';
import { v4 } from 'uuid';

const cluster = _cluster as unknown as _cluster.Cluster;
const logger = pino();

const argv = minimist(process.argv.slice(2));

const NODE_ENV = (process.env.NODE_ENV =
  argv.env || argv.E || process.env.NODE_ENV || 'development');
const template = argv.template || argv.T;

const queues: Record<'master' | 'worker', Record<string, Queue>> = {
  master: {},
  worker: {},
};

async function masterMain(config: IMasterConfig) {
  logger.info('Server starting ...');

  const port = config.port || 8080;
  const redisConfig = config.redis || {};

  const mapperPath = resolve(
    __dirname,
    'modules',
    `mapper${template ? '.template' : ''}.json`,
  );
  const content = await readFile(mapperPath, 'utf8');
  const mapper = JSON.parse(content) as IMapper[];

  const app = fastify({ logger: true });
  app.register(helmet);
  app.register(compression);
  app.all('*', async (request) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    for (const { path, queue: key } of mapper) {
      const { matches } = match(path, url.pathname);
      if (matches) {
        let queue = queues.master[key];
        if (!queue) {
          queue = queues.master[key] = new Queue(key, {
            isWorker: false,
            redis: redisConfig,
          });
          logger.info(`Queue '${key}' master connecting ...`);
          queue.on('ready', () =>
            request.log.info(`Queue '${key}' master is ready`),
          );
        }
        const job = await queue
          .createJob({
            method: request.method,
            url: request.url,
            params: request.query,
          })
          .setId(v4())
          .save();
        return await wait(queue, job, config.timeout || 30 * 1000);
      }
    }
    throw new NotFound();
  });

  process.on('beforeExit', async () => {
    await Promise.allSettled([
      ...Object.values(queues.master).map((q) => q.close()),
      ...Object.values(queues.worker).map((q) => q.close()),
    ]);
  });

  await app.listen({ host: '0.0.0.0', port });
}

async function workerMain(config: IWorkerConfig) {
  logger.info('Worker starting ...');

  const redisConfig = config.redis || {};

  const dependencies = new Dependencies();
  dependencies.register('Logger', logger);
  for (const key of Object.keys(dependencies_)) {
    dependencies.register(key, await dependencies_[key](config));
  }

  await Promise.all(
    config.modules.map((key) =>
      import(resolve(__dirname, 'modules', key)).then(({ process }) => {
        let queue = queues.worker[key];
        if (!queue) {
          queue = queues.worker[key] = new Queue(key, {
            redis: redisConfig,
          });
        }
        logger.info(`Queue '${key}' worker connecting ...`);
        queue.on('ready', () => logger.info(`Queue '${key}' worker is ready`));
        return process(queue, dependencies);
      }),
    ),
  );
}

function wait<T>(queue: Queue, job: Queue.Job<T>, timeout: number) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      await queue.removeJob(job.id);
      reject(new RequestTimeout());
    }, timeout);
    job.on('succeeded', (result: IResult) => {
      clearTimeout(timer);
      resolve(result);
    });
    job.on('failed', (e) => reject(e));
  });
}

async function main() {
  const content = await readFile(
    resolve('configs', `config.${template ? 'template' : NODE_ENV}.yaml`),
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
