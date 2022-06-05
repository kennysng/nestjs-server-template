import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Injectable, Logger } from '@nestjs/common';

const reqLogger = new Logger('Request', { timestamp: true });
const resLogger = new Logger('Response', { timestamp: true });

@Injectable()
export class LogMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl: url } = request;
    const contentLength = request.header('content-length') || 0;
    reqLogger.log(
      `${method} ${url} from ip=${ip} Start (content-length = ${contentLength})`,
    );
    const authorization = request.header('authorization');
    const deviceToken = request.header('x-device-token');
    if (authorization) reqLogger.log(`Authorization: ${authorization}`);
    if (deviceToken) reqLogger.log(`X-Device-Token: ${deviceToken}`);
    if (contentLength) reqLogger.log(`body = ${JSON.stringify(request.body)}`);
    response.on('close', () => {
      const { statusCode } = response;
      resLogger.log(`${method} ${url} End with code=${statusCode}`);
      resLogger.log(
        `content-length = ${response.getHeader('content-length') || 0}`,
      );
    });
    next();
  }
}
