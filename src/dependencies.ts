import { resolve } from 'path';
import { Sequelize as Sequelize_ } from 'sequelize-typescript';

import { IWorkerConfig } from './interface';

export async function Sequelize(config: IWorkerConfig) {
  const { database: dbConfig } = config;
  return new Sequelize_({
    dialect: (dbConfig.dialect as any) || 'mariadb',
    host: dbConfig.host || 'localhost',
    port: dbConfig.port || 3306,
    username: dbConfig.username,
    password: dbConfig.password,
    models: await import(resolve(__dirname, 'models', 'index')).then(
      (m) => m.default,
    ),
  });
}
