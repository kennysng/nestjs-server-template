import { resolve } from 'path';
import { Sequelize } from 'sequelize-typescript';
import { IMasterConfig } from './interface';
import logger from './logger';
import { logSection } from './utils';

async function checkDatabase(sequelize: Sequelize, database: string) {
  const result = await sequelize.query(`
    SELECT SCHEMA_NAME
    FROM INFORMATION_SCHEMA.SCHEMATA
    WHERE SCHEMA_NAME = '${database}'
  `);
  return result.length[0].length === 1;
}

export async function connect(config: IMasterConfig, check = false) {
  const sequelizeLogger = logger('Sequelize');
  const {
    dialect = 'mariadb',
    host = 'localhost',
    port = 3306,
    username,
    password,
    database,
    sync,
  } = config.database;
  const sequelize = new Sequelize({
    dialect: dialect as any,
    host,
    port,
    username,
    password,
    models: await import(resolve(__dirname, 'model', 'index')).then(
      (m) => m.default,
    ),
    logging: (sql, timing) => sequelizeLogger.info({ sql, elapsed: timing }),
  });
  if (sync) {
    if (!check || (await !checkDatabase(sequelize, database))) {
      logSection('Rebuild Database', sequelizeLogger, async () => {
        await sequelize.query(`
              DROP SCHEMA IF EXISTS \`${database}\`;
              CREATE SCHEMA IF NOT EXISTS \`${database}\`;
              USE \`${database}\`;
            `);
        await sequelize.sync({ alter: true });
      });
    }
  }
  return sequelize;
}
