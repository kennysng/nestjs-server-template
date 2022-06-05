import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Injectable, Logger } from '@nestjs/common';

const logger = new Logger('Request', { timestamp: true });

@Injectable()
export class LogMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl: url } = request;
    const contentLength = request.header('content-length') || 0;
    logger.log(
      `${method} ${url} from ip=${ip} Start (content-length = ${contentLength})`,
    );
    const authorization = request.header('authorization');
    const deviceToken = request.header('x-device-token');
    if (authorization) logger.log(`Authorization: ${authorization}`);
    if (deviceToken) logger.log(`X-Device-Token: ${deviceToken}`);
    if (contentLength) logger.log(`body = ${JSON.stringify(request.body)}`);
    response.on('close', () => {
      const { statusCode } = response;
      logger.log(`${method} ${url} End with code=${statusCode}`);
      logger.log(
        `content-length = ${response.getHeader('content-length') || 0}`,
      );
    });
    next();
  }
}
