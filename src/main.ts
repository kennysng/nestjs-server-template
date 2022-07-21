import { INestApplication } from '@nestjs/common';
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
import { LogService } from './modules/model/log.service';
import { PrimaryModule } from './primary.module';

const cluster = _cluster as unknown as _cluster.Cluster;

dotenv.config();

// cluster
async function clusterize(
  createApp: (primaryInCluster?: boolean) => Promise<INestApplication>,
  workerCallback: (app: INestApplication) => Promise<void>,
  primaryCallback?: (app: INestApplication) => Promise<void>,
) {
  const noOfWorkers = +process.env.CLUSTER || 1;
  const app = await createApp(true);
  const logger = app.get(LogService);

  if (cluster.isPrimary && noOfWorkers > 1) {
    logger.log('NestApplication', `Primary server started on ${process.pid}`);

    if (primaryCallback) primaryCallback(app);

    process.on('SIGINT', () => {
      logger.log('NestApplication', 'Nest application shutting down ...');
      for (const id in cluster.workers) {
        cluster.workers[id].kill();
      }
      process.exit(0);
    });

    const numCPUs = cpus().length;
    for (let i = 0; i < Math.min(numCPUs, +process.env.CLUSTER || 1); i++) {
      cluster.fork();
    }

    cluster.on('online', (worker) => {
      logger.log('NestApplication', `Worker ${worker.process.pid} started`);
    });

    cluster.on('exit', (worker) => {
      logger.log(
        'NestApplication',
        `Worker ${worker.process.pid} died. Restarting ...`,
      );
      cluster.fork();
    });
  } else if (noOfWorkers > 1) {
    workerCallback(await createApp());
  } else {
    const app = await createApp();
    primaryCallback(app);
    workerCallback(app);
  }
}

clusterize(
  (primaryInCluster = false) => {
    return NestFactory.create(primaryInCluster ? PrimaryModule : AppModule);
  },
  async (app) => {
    app.use(helmet());
    app.use(compression());
    app.useGlobalFilters(...appFilters());
    const configService = app.get(ConfigService);
    const port = configService.port || 3000;
    await app.listen(port);
  },
  async (app) => {
    const configService = app.get(ConfigService);
    const sequelize = app.get(Sequelize);

    // rebuild database structure
    if (configService.mysql.rebuild) {
      // TODO drop and create schema
      await sequelize.sync({ alter: true });
    }
  },
);
