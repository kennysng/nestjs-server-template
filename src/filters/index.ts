import type { ExceptionFilter } from '@nestjs/common';

import { HttpExceptionFilter } from './http.exception.filter';

export default () => {
  return [new HttpExceptionFilter()] as ExceptionFilter[];
};
