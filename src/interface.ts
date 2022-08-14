import { HttpStatus } from 'http-status';

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

export interface IMasterConfig extends IBaseConfig {
  port?: number;
}

export interface IWorkerConfig extends IBaseConfig {
  modules: string[];
  database: {
    dialect?: string;
    host?: string;
    port?: number;
    username: string;
    password: string;
    database: string;
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
  queue: string;
}

export interface IResult {
  code: HttpStatus;
  result: any;
}
