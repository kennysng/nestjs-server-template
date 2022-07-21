import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { ConfigModule } from './config.module';
import { ConfigService } from './config.service';
import models from './models';
import { LogService } from './modules/log.service';

@Module({
  imports: [
    // load configs from yaml
    ConfigModule,

    // connect database
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService, LogService],
      useFactory: (configService: ConfigService, logService: LogService) => ({
        dialect: 'mysql',
        logging: configService.mysql.log
          ? (sql) => logService.get('Sequelize').log(sql)
          : false,
        host: configService.mysql.host || 'localhost',
        port: configService.mysql.port || 3306,
        username: configService.mysql.username,
        password: configService.mysql.password,
        database: configService.mysql.database,
        models,
      }),
    }),
  ],
  providers: [ConfigService],
})
export class PrimaryModule {}
