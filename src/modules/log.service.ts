import { Injectable, LoggerService } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import moment from 'moment';
import { Sequelize } from 'sequelize-typescript';

import { Log, LogType } from 'src/models/log.model';
import { BaseDtoService } from './dto/dto.service';

class Logger implements LoggerService {
  constructor(
    private readonly section: string,
    private readonly logService: LogService,
  ) {}

  _log(type: LogType, message: string, extra?: any) {
    if (process.env.NODE_ENV === 'local') {
      if (type === LogType.verbose) type = LogType.debug;
      if (extra && typeof extra !== 'string') extra = JSON.stringify(extra);
      console[type](
        `[${moment().toISOString()}] <${this.section}> ${message} ${extra}`,
      );
    } else {
      if (message && typeof message !== 'string') {
        message = JSON.stringify(message);
      }
      this.logService.create({
        type,
        section: this.section,
        message,
        extra,
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

@Injectable()
export class LogService extends BaseDtoService<Log> {
  constructor(sequelize: Sequelize, @InjectModel(Log) model: typeof Log) {
    super(sequelize, model, { deleteMode: 'destroy' });
  }

  get(section: string): LoggerService {
    return new Logger(section, this);
  }

  // @override
  public toJSON(instance: Log): Log {
    return {
      id: instance.id,
      type: instance.type,
      section: instance.section,
      message: instance.message,
      extra: instance.extra,
      createdAt: instance.createdAt,
    } as Log;
  }
}
