import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';

import { Logger } from 'src/logger';
import { Log } from 'src/models/log.model';
import { BaseDtoService } from './dto.service';

@Injectable()
export class LogService extends BaseDtoService<Log> {
  constructor(
    @Inject(forwardRef(() => Sequelize)) sequelize: Sequelize,
    @InjectModel(Log) model: typeof Log,
  ) {
    super(sequelize, model, { deleteMode: 'destroy' });
    Logger.init(this);
  }
}
