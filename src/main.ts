import type { NestApplication } from '@nestjs/core';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as _cluster from 'cluster';
import * as compression from 'compression';
import helmet from 'helmet';
import { cpus } from 'os';
import { Sequelize } from 'sequelize-typescript';

import { AppModule } from './app.module';
import { ConfigService } from './config.service';
import { PrimaryModule } from './primary.module';

const cluster = _cluster as unknown as _cluster.Cluster;

// logger
const logger = new Logger('NestApplication');

// cluster
async function clusterize(
  createApp: (primaryInCluster?: boolean) => Promise<NestApplication>,
  workerCallback: (app: NestApplication) => Promise<void>,
  primaryCallback?: (app: NestApplication) => Promise<void>,
) {
  const noOfWorkers = +process.env.CLUSTER || 1;
  if (cluster.isPrimary && noOfWorkers > 1) {
    logger.log(`Primary server started on ${process.pid}`);

    if (primaryCallback) primaryCallback(await createApp(true));

    process.on('SIGINT', () => {
      console.log('Nest application shutting down ...');
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
      logger.log(`Worker ${worker.process.pid} started`);
    });

    cluster.on('exit', (worker) => {
      logger.log(`Worker ${worker.process.pid} died. Restarting ...`);
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
  async (primaryInCluster = false) => {
    return await NestFactory.create(
      primaryInCluster ? PrimaryModule : AppModule,
    );
  },
  async (app) => {
    app.use(helmet());
    app.use(compression());
    const configService = app.get(ConfigService);
    const port = configService.port || 3000;
    await app.listen(port);
  },
  async (app) => {
    const configService = app.get(ConfigService);
    if (configService.mysql.sync) {
      const sequelize = app.get(Sequelize);
      await sequelize.sync({ alter: true });
    }
  },
);
