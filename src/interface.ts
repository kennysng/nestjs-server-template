import type { Includeable } from 'sequelize';

import { FastifyReply, FastifyRequest } from 'fastify';
import { Logger } from 'pino';

export class Dependencies {
  private static instance: Dependencies;
  private readonly dependencies: Record<string, any> = {};

  constructor() {
    if (!Dependencies.instance) Dependencies.instance = this;
    return Dependencies.instance;
  }

  register<T>(key: string, dependency: T) {
    this.dependencies[key] = dependency;
  }

  get<T>(key: string): T {
    return this.dependencies[key];
  }
}

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

interface ITokenOptions {
  secret?: string;
  expires_in?: string;
}

export interface IMasterConfig extends IBaseConfig {
  port?: number;
  package?: string;
  auth: {
    access_token: ITokenOptions;
    refresh_token: ITokenOptions;
  };
}

export interface IWorkerConfig extends IBaseConfig {
  modules: string[];
  database?: {
    dialect?: string;
    host?: string;
    port?: number;
    username: string;
    password: string;
    database: string;
    sync?: boolean;
  };
}

export type IConfig = IMasterConfig | IWorkerConfig;

export enum ServerType {
  MASTER = 'master',
  WORKER = 'worker',
  HYBRID = 'hybrid',
}

export interface IMapper {
  path: string;
  before?: string[];
  after?: string[];
  queue: string;
}

export interface IRequest<Q = any, B = any> {
  method: string;
  url: string;
  query?: Q;
  body?: B;
}

export interface IResult<T = any> {
  statusCode: number;
  error?: string;
  message?: string;
  result?: T;
  elapsed?: number;
}

export interface IMiddlewareArgs {
  config: IMasterConfig;
  request: FastifyRequest;
  reply: FastifyReply;
  jobData: IRequest;
  result: IResult;
}

export type Options = {
  logger?: Logger;
  defaultInclude?: Includeable[];
  deleteMode?: 'deletedAt' | 'destroy';
};
