import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Injectable, Logger } from '@nestjs/common';

const logger = new Logger('BodyParser', { timestamp: true });

/**
 * ensure the request body is parsed to JSON
 */
@Injectable()
export class BodyMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    if (typeof request.body === 'string') {
      try {
        request.body = JSON.parse(request.body);
        const { method, originalUrl: url } = request;
        logger.warn(`Built-in body parser not work on ${method} ${url}`);
      } catch (e) {
        // it's not JSON
      }
    }
    next();
  }
}
