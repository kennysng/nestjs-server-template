import { HttpStatus } from 'http-status';

interface IBaseConfig {
  clusters?: boolean | number;
  timeout?: number;
  redis?: {
    secure?: boolean;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
}

export interface IMasterConfig extends IBaseConfig {
  port?: number;
  queues: Record<string, string>;
}

export interface IWorkerConfig extends IBaseConfig {
  modules: string[];
}

export type IConfig = IMasterConfig | IWorkerConfig;

export enum ServerType {
  MASTER = 'master',
  WORKER = 'worker',
  HYBRID = 'hybrid',
}

export interface IResult {
  code: HttpStatus;
  result: any;
}
