import { Injectable, LoggerService } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Log, LogType } from 'src/models/log.model';
import { BaseDtoService } from '../dto/dto.service';

@Injectable()
export class LogService extends BaseDtoService<Log> implements LoggerService {
  constructor(sequelize: Sequelize, @InjectModel(Log) model: typeof Log) {
    super(sequelize, model, [], 'destroy');
  }

  log(section: string, message: any, extra?: any) {
    if (typeof message !== 'string') message = JSON.stringify(message);
    this.create({ type: LogType.log, section, message, extra });
  }

  error(section: string, message: any, extra?: any) {
    if (typeof message !== 'string') message = JSON.stringify(message);
    this.create({ type: LogType.error, section, message, extra });
  }

  warn(section: string, message: any, extra?: any) {
    if (typeof message !== 'string') message = JSON.stringify(message);
    this.create({ type: LogType.warn, section, message, extra });
  }

  debug(section: string, message: any, extra?: any) {
    if (typeof message !== 'string') message = JSON.stringify(message);
    this.create({ type: LogType.debug, section, message, extra });
  }

  verbose(section: string, message: any, extra?: any) {
    if (typeof message !== 'string') message = JSON.stringify(message);
    this.create({ type: LogType.verbose, section, message, extra });
  }

  // @override
  public toJSON(instance: Log): Log {
    return {
      id: instance.id,
      taskId: instance.taskId,
      type: instance.type,
      section: instance.section,
      message: instance.message,
      extra: instance.extra,
      createdAt: instance.createdAt,
    } as Log;
  }
}
