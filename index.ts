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
  IConfig,
  IMasterConfig,
  IResult,
  IWorkerConfig,
  ServerType,
} from 'interface';
import { match } from 'node-match-path';
import { URL } from 'url';
import * as _cluster from 'cluster';
import { cpus } from 'os';

const cluster = _cluster as unknown as _cluster.Cluster;

const argv = minimist(process.argv.slice(2));

async function masterMain(config: IMasterConfig) {
  const port = config.port || 8080;
  const redisConfig = config.redis || {};

  const queues: Record<string, Queue> = {};

  const app = fastify({ logger: true });
  app.register(helmet);
  app.register(compression);
  app.all('*', async (request) => {
    const url = new URL(request.url, `http://localhost:${port}`);
    for (const [key, value] of Object.entries(config.queues)) {
      const { matches } = match(value, url.pathname);
      if (matches) {
        let queue = queues[key];
        if (!queue) {
          queue = queues[key] = new Queue(key, {
            getEvents: false,
            isWorker: false,
            redis: redisConfig,
          });
        }
        queue.on('ready', () => request.log.info(`Queue '${key}' is ready`));
        const job = await queue
          .createJob({
            method: request.method,
            url: request.url,
            params: request.query,
          })
          .save();
        return await wait(queue, job, config.timeout || 30 * 1000);
      }
    }
    throw new NotFound();
  });

  process.on('beforeExit', async () => {
    await Promise.allSettled(Object.values(queues).map((q) => q.close()));
  });

  await app.listen({ port });
}

async function workerMain(config: IWorkerConfig) {
  // TODO
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
  const NODE_ENV = (process.env.NODE_ENV =
    argv.env || argv.E || process.env.NODE_ENV || 'development');
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
    case 'queues' in config && 'modules' in config: {
      serverType = ServerType.HYBRID;
      break;
    }
    case 'queues' in config: {
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
