import type {
  ArgumentsHost,
  ExceptionFilter,
  LoggerService,
} from '@nestjs/common';

import { Catch, HttpException } from '@nestjs/common';
import { Response } from 'express';

import { LogService } from 'src/modules/log.service';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  protected readonly logger: LoggerService;

  constructor(logService: LogService) {
    this.logger = logService.get('HttpException');
  }

  // @override
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

      if (stack) this.logger.error(stack);

      response.status(status).send({
        statusCode: status,
        message: message.split('\n'),
      });
    }
  }
}
