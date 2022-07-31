import {
  AllowNull,
  AutoIncrement,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';

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

  @Column(DataType.INTEGER)
  pid: number;

  @Column(DataType.ENUM('log', 'info', 'warn', 'error'))
  type: LogType;

  @Column(DataType.STRING(256))
  section: string;

  @Column(DataType.TEXT)
  message: string;

  @Column(DataType.BIGINT)
  elapsed?: any;

  @AllowNull(true)
  @Column(DataType.JSON)
  extra?: any;

  @AllowNull(false)
  @Column(DataType.DATE)
  createdAt: Date;
}
