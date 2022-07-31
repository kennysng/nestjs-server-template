import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import type { RedisClientOptions } from 'redis';

import { HttpModule } from '@nestjs/axios';
import { CacheInterceptor, CacheModule, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import * as redisStore from 'cache-manager-redis-store';

import { AppController } from './app.controller';
import { ConfigModule } from './config.module';
import { ConfigService } from './config.service';
import middlewares from './middlewares';
import { DatabaseModule } from './modules/dto/dto.modules';

const modules = [];

@Module({
  imports: [
    // load configs from yaml
    ConfigModule,

    // connect database
    DatabaseModule,

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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(...middlewares).forRoutes('*');
  }
}
