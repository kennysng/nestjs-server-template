import { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import type { Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import type { Job } from 'bee-queue';
import * as httpErrors from 'http-errors';
import Queue = require('bee-queue');
import { IResult } from './interface';

type Result<T> = {
  result?: T;
  error?: any;
  start: number;
  end: number;
};

const queues: Record<'server' | 'worker', Record<string, Queue>> = {
  server: {},
  worker: {},
};

// close queue connections
process.on('beforeExit', () => {
  Promise.allSettled([
    ...Object.values(queues.server).map((q) => q.close()),
    ...Object.values(queues.worker).map((q) => q.close()),
  ]);
});

export function connectQueue(
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

export function wait<T, R = any>(
  queue: Queue,
  job: Job<T>,
  timeout: number,
): Promise<IResult<R>> {
  return new Promise<IResult>((resolve, reject) => {
    const timer = setTimeout(async () => {
      queue.removeJob(job.id);
      reject(new httpErrors.GatewayTimeout());
    }, timeout);
    job.on('succeeded', (result: IResult) => {
      clearTimeout(timer);
      resolve(result);
    });
    job.on('failed', (e) =>
      reject(httpErrors[e.message] ? new httpErrors[e.message]() : e),
    );
  });
}

export function fixUrl(url: string) {
  if (!url.startsWith('/')) url = '/' + url;
  while (url.endsWith('/')) url = url.substring(0, url.length - 1);
  return url;
}

export async function logElapsed<T>(
  callback: () => T | Promise<T>,
): Promise<Result<T>> {
  const now = Date.now();
  try {
    const result = await callback();
    return { result, start: now, end: Date.now() };
  } catch (error) {
    return { error, start: now, end: Date.now() };
  }
}

export async function logSection<T>(
  func: string,
  logger: Logger,
  callback: () => T | Promise<T>,
) {
  logger.debug({ func }, 'start');
  const { result, error, start, end } = await logElapsed(callback);
  if (error) {
    throw error;
  } else {
    logger.debug({ func, elapsed: end - start }, 'end');
    return result;
  }
}

export async function inTransaction<T>(
  sequelize: Sequelize,
  callback: (transaction: Transaction) => Promise<T>,
  transaction?: Transaction,
): Promise<T> {
  const withTransaction = !!transaction;
  let rollback = false;
  if (!withTransaction) transaction = await sequelize.transaction();
  try {
    return await callback(transaction);
  } catch (e) {
    if (!withTransaction) {
      await transaction.rollback();
      rollback = true;
    }
    throw e;
  } finally {
    if (!withTransaction && !rollback) await transaction.commit();
  }
}
