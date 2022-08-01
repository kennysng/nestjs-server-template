import type { LoggerService } from '@nestjs/common';

import { CustomException } from 'src/classes/exceptions/CustomException';

type Result<T> = {
  result?: T;
  error?: any;
  start: number;
  end: number;
};

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
  logger: LoggerService,
  callback: () => T | Promise<T>,
) {
  logger.debug(`${func} start`, { elapsed: 0 });
  const { result, error, start, end } = await logElapsed(callback);
  if (error) {
    CustomException.throw(func, error);
  } else {
    logger.debug(`${func} end`, { elapsed: end - start });
    return result;
  }
}
