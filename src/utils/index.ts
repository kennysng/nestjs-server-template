import { LoggerService } from '@nestjs/common';

import { CustomException } from 'src/classes/exceptions/CustomException';

export async function logSection<T>(
  func: string,
  logger: LoggerService,
  callback: () => T | Promise<T>,
) {
  try {
    logger.debug(`.${func} start`);
    const result = await callback();
    logger.debug(`.${func} end`);
    return result;
  } catch (e) {
    logger.error(`.${func} ${e.message}`);
    if (e.errors) {
      for (const error of e.errors) {
        logger.error(`.${func} ${error.message}`);
      }
    }
    logger.error(`.${func} ${e.stack}`);
    CustomException.throw(func, e);
  }
}
