import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { Task } from './task.model';

export enum LogType {
  log = 'log',
  error = 'error',
  warn = 'warn',
  debug = 'debug',
  verbose = 'verbose',
}

@Table({
  indexes: [{ fields: ['createdAt'] }],
})
export class Log extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id?: number;

  @ForeignKey(() => Task)
  @Column(DataType.BIGINT)
  taskId?: number;

  @Column(DataType.ENUM('log', 'info', 'warn', 'error'))
  type: LogType;

  @Column(DataType.STRING(256))
  section: string;

  @Column(DataType.TEXT)
  message: string;

  @AllowNull(true)
  @Column(DataType.JSON)
  extra?: any;

  @AllowNull(false)
  @Column(DataType.DATE)
  createdAt: Date;

  // #region relationships

  @BelongsTo(() => Task, {
    foreignKey: {
      name: 'taskId',
      allowNull: true,
    },
  })
  task: Task;

  // #endregion
}
