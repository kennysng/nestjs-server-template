import type { LogService } from './modules/dto/log.service';
import type { LoggerService } from '@nestjs/common';

import colors = require('colors');
import { DateTime } from 'luxon';

import { Log, LogType } from 'src/models/log.model';

type IExtra = {
  tag?: string;
  elapsed?: number;
  extra?: any;
};

const colorMapping = {
  log: 'green',
  error: 'red',
  warn: 'yellow',
  debug: 'gray',
  verbose: 'gray',
};

export class Logger implements LoggerService {
  private static logService: LogService;
  private static timeout: NodeJS.Timeout | undefined;
  private static queue: Partial<Log>[] = [];
  private static timestamp = Date.now();

  static init(logService: LogService) {
    this.logService = logService;
    if (Logger.queue.length) {
      Logger.addToQueue();
    }
  }

  private static addToQueue(log?: Partial<Log>) {
    if (Logger.timeout) {
      clearTimeout(Logger.timeout);
      Logger.timeout = undefined;
    }
    if (log) Logger.queue.push(log);
    if (Logger.logService) {
      setTimeout(() => {
        const queue = Logger.queue;
        Logger.queue = [];
        Logger.logService.create(queue);
      }, 10 * 1000);
    }
  }

  constructor(private readonly section: string) {}

  private _log(type: LogType, message: string, extra: string | IExtra = '') {
    const now = Date.now();
    const tag = typeof extra === 'string' ? extra : extra.tag;
    const section = tag || this.section;
    const elapsed =
      typeof extra === 'string' ? now - Logger.timestamp : extra.elapsed;
    const elapsed_ = elapsed ? `+${elapsed}ms` : '';
    if (process.env.NODE_ENV === 'local') {
      if (type === LogType.verbose) type = LogType.debug;
      Logger.timestamp = now;
      console[type](
        `${colors.green(
          `[Nest] ${process.pid} -`,
        )} ${DateTime.now().toLocaleString(
          DateTime.DATETIME_SHORT,
        )} ${colors.yellow(`[${section}]`)} ${colors[colorMapping[type]](
          message,
        )} ${colors.yellow(elapsed_)}`,
      );
    } else {
      if (message && typeof message !== 'string') {
        message = JSON.stringify(message);
      }
      const { extra: extra_ } =
        typeof extra === 'string' ? ({} as IExtra) : extra;
      Logger.addToQueue({
        type,
        pid: process.pid,
        section: section,
        message,
        elapsed,
        extra: extra_,
      });
    }
  }

  log(message: any, extra?: any) {
    this._log(LogType.log, message, extra);
  }

  error(message: any, extra?: any) {
    this._log(LogType.error, message, extra);
  }

  warn(message: any, extra?: any) {
    this._log(LogType.warn, message, extra);
  }

  debug(message: any, extra?: any) {
    this._log(LogType.debug, message, extra);
  }

  verbose(message: any, extra?: any) {
    this._log(LogType.verbose, message, extra);
  }
}
