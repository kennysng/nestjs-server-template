import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import type { RedisClientOptions } from 'redis';

import { HttpModule } from '@nestjs/axios';
import { CacheInterceptor, CacheModule, Logger, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { SequelizeModule } from '@nestjs/sequelize';
import { TerminusModule } from '@nestjs/terminus';
import * as redisStore from 'cache-manager-redis-store';

import { AppController } from './app.controller';
import { ConfigModule } from './config.module';
import { ConfigService } from './config.service';
import middlewares from './middlewares';
import models from './models';
import { AppService } from './app.service';

const sequelizeLogger = new Logger('Sequelize', { timestamp: true });

const modules = [];

@Module({
  imports: [
    // load configs from yaml
    ConfigModule,

    // connect database
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        dialect: 'mysql',
        logging: configService.mysql.log
          ? (sql) => sequelizeLogger.log(sql)
          : false,
        host: configService.mysql.host || 'localhost',
        port: configService.mysql.port || 3306,
        username: configService.mysql.username,
        password: configService.mysql.password,
        database: configService.mysql.database,
        models,
      }),
    }),

    // enable redis cache
    CacheModule.registerAsync<RedisClientOptions>({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (configService.redis) {
          return {
            isGlobal: true,
            store: redisStore,
            ...configService.redis,
          };
        } else {
          return { isGlobal: true };
        }
      },
    }),

    // enable schedule task
    ScheduleModule.forRoot(),

    // enable axios call
    HttpModule,

    // enable health check
    TerminusModule,

    // my modules
    ...modules,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    AppService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(...middlewares).forRoutes('*');
  }
}
