import { Logger } from '@nestjs/common';

import { CustomException } from 'src/classes/exceptions/CustomException';

export async function logSection<T>(
  func: string,
  logger: Logger,
  callback: () => T | Promise<T>,
) {
  try {
    logger.debug(`${func} start`);
    const result = await callback();
    logger.debug(`${func} end`);
    return result;
  } catch (e) {
    logger.error(`${func} error: ${e.message}`);
    if (e.errors) {
      for (const error of e.errors) {
        logger.error(`error: ${error.message}`);
      }
    } else {
      logger.error(e.stack);
    }
    CustomException.throw(func, e);
  }
}
