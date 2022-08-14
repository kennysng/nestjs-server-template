import { HttpStatus } from 'http-status';

export interface IConfig {
  port?: number;
  timeout?: number;
  queues: Record<string, string>;
  redis?: {
    secure?: boolean;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
}

export interface IResult {
  code: HttpStatus;
  result: any;
}
