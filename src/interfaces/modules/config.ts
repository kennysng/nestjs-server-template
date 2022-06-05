export abstract class IConfig {
  port?: number;
  cluster?: boolean | number;

  mysql: {
    host?: string;
    port?: number;
    username: string;
    password: string;
    database?: string;
    rebuild?: boolean;
    log?: boolean;
  };

  redis?: {
    host?: string;
    port?: number;
  };
}
