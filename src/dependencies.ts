import { resolve } from 'path';
import pino from 'pino';
import { Sequelize as Sequelize_ } from 'sequelize-typescript';

import { IWorkerConfig } from './interface';

export async function Sequelize(config: IWorkerConfig) {
  const logger = pino({ name: 'Sequelize' });
  const {
    database: {
      dialect = 'mysql',
      host = 'localhost',
      port = 3306,
      username,
      password,
      database,
      sync,
    },
  } = config;
  const sequelize = new Sequelize_({
    dialect: dialect as any,
    host,
    port,
    username,
    password,
    models: await import(resolve(__dirname, 'models', 'index')).then(
      (m) => m.default,
    ),
    logging: (sql, timing) => logger.info({ sql, timing }),
  });
  if (sync) {
    await sequelize.query(`DROP SCHEMA IF EXISTS \`${database}\`;`);
    await sequelize.query(`CREATE SCHEMA IF NOT EXISTS \`${database}\`;`);
    await sequelize.query(`USE \`${database}\`;`);
    await sequelize.sync({ alter: true });
  }
  return sequelize;
}
