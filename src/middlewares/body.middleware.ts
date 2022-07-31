import type { LoggerService, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Injectable } from '@nestjs/common';

import { Logger } from 'src/logger';

/**
 * ensure the request body is parsed to JSON
 */
@Injectable()
export class BodyParserMiddleware implements NestMiddleware {
  protected readonly logger: LoggerService;

  constructor() {
    this.logger = new Logger('BodyParser');
  }

  // @override
  use(request: Request, response: Response, next: NextFunction): void {
    if (typeof request.body === 'string') {
      try {
        request.body = JSON.parse(request.body);
        const { method, originalUrl: url } = request;
        this.logger.warn(`Built-in body parser not work on ${method} ${url}`);
      } catch (e) {
        // it's not JSON
      }
    }
    next();
  }
}
