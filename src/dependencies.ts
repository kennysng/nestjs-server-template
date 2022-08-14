import { IWorkerConfig } from './interface';
import { Sequelize as Sequelize_ } from 'sequelize-typescript';
import { resolve } from 'path';

export async function Sequelize(config: IWorkerConfig) {
  const { database: dbConfig } = config;
  return new Sequelize_({
    dialect: (dbConfig.dialect as any) || 'mariadb',
    host: dbConfig.host || 'localhost',
    port: dbConfig.port || 3306,
    username: dbConfig.username,
    password: dbConfig.password,
    models: await import(resolve(__dirname, 'models', 'index.ts')).then(
      (m) => m.default,
    ),
  });
}
