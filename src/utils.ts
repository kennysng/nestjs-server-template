import { FastifyBaseLogger, FastifyReply } from 'fastify';
import type { Logger } from 'pino';
import type { Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import type { Job } from 'bee-queue';
import { BadRequest, HttpError } from 'http-errors';
import * as httpErrors from 'http-errors';
import Queue = require('bee-queue');
import { ICache, IResponse } from './interface';
import { DateTime } from 'luxon';
import httpStatus = require('http-status');

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

type Result<T> = {
  result?: T;
  error?: any;
  start: number;
  end: number;
};

export class MyError extends Error {
  constructor(private readonly error: HttpError, public readonly extra?: any) {
    super(error.message);
  }

  get expose() {
    return this.error.expose;
  }

  get headers() {
    return this.error.headers;
  }

  get message() {
    return this.error.message;
  }

  get name() {
    return this.error.name;
  }

  get stack() {
    return this.error.stack;
  }

  get status() {
    return this.error.status;
  }

  get statusCode() {
    return this.error.statusCode;
  }
}

export class ValidationError extends MyError {
  constructor(errors?: string[]) {
    super(new BadRequest('Validation Error'), errors);
  }
}

export type Nullable<T, N = undefined> = T | N;

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
): Promise<IResponse<R>> {
  return new Promise<IResponse>((resolve, reject) => {
    const timer = setTimeout(async () => {
      queue.removeJob(job.id);
      reject(new httpErrors.GatewayTimeout());
    }, timeout);
    job.on('succeeded', (result: IResponse) => {
      clearTimeout(timer);
      if ('error' in result) {
        reject(
          new MyError(
            new httpErrors[result.statusCode](
              /* eslint-disable */ result.error ||
              (httpStatus[`${result.statusCode}_NAME`] as string), /* eslint-enable */

            ),
            result.extra,
          ),
        );
      } else {
        resolve(result);
      }
    });
    job.on('failed', (e) => reject(e));
  });
}

export function concat(source: string, segment: string, delimit = ', ') {
  if (source) source += delimit;
  return source + segment;
}

export function applyCache(
  reply: FastifyReply,
  { private: private_, noCache, noStore, maxAge, lastModified }: ICache,
) {
  let cache = '';
  if (typeof private_ === 'boolean') {
    cache = concat(cache, private_ ? 'private' : 'public');
  }
  if (noCache) {
    cache = concat(cache, 'no-cache');
  }
  if (noStore) {
    cache = concat(cache, 'no-store');
  }
  if (typeof maxAge === 'number') {
    cache = concat(
      cache,
      `${private_ === false ? 's-maxage' : 'max-age'}=${maxAge}`,
    );
    reply.header('expires', DateTime.local().plus({ second: maxAge }).toHTTP());
  }
  if (typeof lastModified === 'string') {
    reply.header('last-modified', lastModified);
  }
  reply.header('cache-control', cache);
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
