import type { INestApplication } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';
import * as _cluster from 'cluster';
import * as compression from 'compression';
import dotenv = require('dotenv');
import helmet from 'helmet';
import { cpus } from 'os';
import { Sequelize } from 'sequelize-typescript';

import { AppModule } from './app.module';
import { ConfigService } from './config.service';
import appFilters from './filters';
import { Logger } from './logger';
import { PrimaryModule } from './primary.module';
import { logSection } from './utils';

const cluster = _cluster as unknown as _cluster.Cluster;

dotenv.config();

process.env.NODE_ENV = process.env.NODE_ENV || 'local';

// cluster
async function clusterize(
  createApp: (
    logger: Logger,
    primaryInCluster?: boolean,
  ) => Promise<INestApplication>,
  workerCallback: (app: INestApplication, logger: Logger) => Promise<void>,
  primaryCallback?: (app: INestApplication, logger: Logger) => Promise<void>,
) {
  const logger = new Logger('NestApplication');
  const app = await createApp(logger, true);

  const configService = app.get(ConfigService);
  const noOfWorkers = configService.cluster || 1;

  if (cluster.isPrimary && noOfWorkers > 1) {
    if (primaryCallback) primaryCallback(app, logger);

    process.on('SIGINT', () => {
      for (const id in cluster.workers) {
        cluster.workers[id].kill();
      }
      process.exit(0);
    });

    const numCPUs = cpus().length;
    for (let i = 0; i < Math.min(numCPUs, +noOfWorkers || 1); i++) {
      const worker = cluster.fork();
      // re-fork if worker down
      worker.on('exit', () => cluster.fork());
    }
  } else if (noOfWorkers > 1) {
    workerCallback(await createApp(logger), logger);
  } else {
    const app = await createApp(logger);
    primaryCallback(app, logger);
    workerCallback(app, logger);
  }
}

clusterize(
  (logger, primaryInCluster = false) => {
    return NestFactory.create(primaryInCluster ? PrimaryModule : AppModule, {
      logger,
    });
  },
  async (app, logger) => {
    const now = Date.now();
    app.use(helmet());
    app.use(compression());
    app.useGlobalFilters(...appFilters());
    const configService = app.get(ConfigService);
    const port = configService.port || 3000;
    await app.listen(port, () =>
      logger.log(`Worker thread listening to port ${port}`, {
        elapsed: Date.now() - now,
      }),
    );
  },
  async (app, logger) => {
    const config = app.get(ConfigService);
    const sequelize = app.get(Sequelize);

    // rebuild database structure
    if (config.mysql.rebuild) {
      if (!config.mysql.database) {
        throw new Error('Missing config.mysql.database');
      }
      logSection('rebuildDatabase', logger, async () => {
        await sequelize.query(
          `DROP SCHEMA IF EXISTS \`${config.mysql.database}\`;`,
        );
        await sequelize.query(
          `CREATE SCHEMA IF NOT EXISTS \`${config.mysql.database}\`;`,
        );
        await sequelize.query(`USE \`${config.mysql.database}\`;`);
        await sequelize.sync({ alter: true });
      });
    }

    logger.log('Primary thread (run only once) done');
  },
);
