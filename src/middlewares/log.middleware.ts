import type { LoggerService, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Injectable } from '@nestjs/common';

import { Logger } from 'src/logger';

@Injectable()
export class LogMiddleware implements NestMiddleware {
  protected readonly reqLogger: LoggerService;
  protected readonly resLogger: LoggerService;

  constructor() {
    this.reqLogger = new Logger('Request');
    this.resLogger = new Logger('Response');
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const now = Date.now();
    const { ip, method, originalUrl: url } = request;
    const contentLength = request.header('content-length') || 0;
    this.reqLogger.log(
      `${method} ${url} from ip=${ip} Start (content-length = ${contentLength})`,
      { elapsed: 0 },
    );
    const authorization = request.header('authorization');
    const deviceToken = request.header('x-device-token');
    if (authorization) {
      this.reqLogger.debug(`Authorization: ${authorization}`, { elapsed: 0 });
    }
    if (deviceToken) {
      this.reqLogger.debug(`X-Device-Token: ${deviceToken}`, { elapsed: 0 });
    }
    if (contentLength) {
      this.reqLogger.debug(`body = ${JSON.stringify(request.body)}`, {
        elapsed: 0,
      });
    }
    response.on('close', () => {
      const { statusCode } = response;
      this.resLogger.log(`${method} ${url} End with code=${statusCode}`, {
        elapsed: Date.now() - now,
      });
      this.resLogger.debug(
        `content-length = ${response.getHeader('content-length') || 0}`,
        { elapsed: 0 },
      );
    });
    next();
  }
}
