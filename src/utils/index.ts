import { Logger } from '@nestjs/common';

export async function logSection<T>(
  logger: Logger,
  name: string,
  callback: () => T | Promise<T>,
) {
  try {
    logger.debug(`${name} start`);
    return await callback();
  } finally {
    logger.debug(`${name} end`);
  }
}
