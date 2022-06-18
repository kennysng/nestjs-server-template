import { Logger } from '@nestjs/common';

import { CustomException } from 'src/classes/exceptions/CustomException';

export async function logSection<T>(
  logger: Logger,
  name: string,
  callback: () => T | Promise<T>,
) {
  try {
    logger.debug(`${name} start`);
    const result = await callback();
    logger.debug(`${name} end`);
    return result;
  } catch (e) {
    logger.error(`${name} error: ${e.message}`);
    if (e.errors) {
      for (const error of e.errors) {
        logger.error(`error: ${error.message}`);
      }
    } else {
      logger.error(e.stack);
    }
    CustomException.throw(name, e);
  }
}
