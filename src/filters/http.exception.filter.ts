import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

import { Catch, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';

const logger = new Logger('Exception');

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    if (process.env.NODE_ENV !== 'production') {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const status = exception.getStatus();
      let message = exception.message;
      let stack = exception.stack;

      if ('errors' in exception) {
        message = (exception['errors'] as any[])
          .map((e) => e.message)
          .join('\n');
        stack = `${message}\n${stack}`;
      }

      if (stack) logger.error(stack);

      response.status(status).send({
        statusCode: status,
        message: message.split('\n'),
      });
    }
  }
}
