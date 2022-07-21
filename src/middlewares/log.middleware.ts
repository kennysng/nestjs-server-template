import type { LoggerService, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Injectable } from '@nestjs/common';

import { LogService } from 'src/modules/log.service';

@Injectable()
export class LogMiddleware implements NestMiddleware {
  protected readonly reqLogger: LoggerService;
  protected readonly resLogger: LoggerService;

  constructor(logService: LogService) {
    this.reqLogger = logService.get('Request');
    this.resLogger = logService.get('Response');
  }

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl: url } = request;
    const contentLength = request.header('content-length') || 0;
    this.reqLogger.log(
      `${method} ${url} from ip=${ip} Start (content-length = ${contentLength})`,
    );
    const authorization = request.header('authorization');
    const deviceToken = request.header('x-device-token');
    if (authorization) this.reqLogger.log(`Authorization: ${authorization}`);
    if (deviceToken) this.reqLogger.log(`X-Device-Token: ${deviceToken}`);
    if (contentLength) {
      this.reqLogger.log(`body = ${JSON.stringify(request.body)}`);
    }
    response.on('close', () => {
      const { statusCode } = response;
      this.resLogger.log(`${method} ${url} End with code=${statusCode}`);
      this.resLogger.log(
        `content-length = ${response.getHeader('content-length') || 0}`,
      );
    });
    next();
  }
}
