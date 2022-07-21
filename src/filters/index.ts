import type { ExceptionFilter } from '@nestjs/common';
import { LogService } from 'src/modules/log.service';

import { HttpExceptionFilter } from './http.exception.filter';

export default (logService: LogService) => {
  return [new HttpExceptionFilter(logService)] as ExceptionFilter[];
};
