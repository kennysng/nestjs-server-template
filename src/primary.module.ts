import { Logger, Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { ConfigModule } from './config.module';
import { ConfigService } from './config.service';
import models from './models';

const sequelizeLogger = new Logger('Sequelize', { timestamp: true });

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
  ],
  providers: [ConfigService],
})
export class PrimaryModule {}
