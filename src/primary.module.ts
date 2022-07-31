import { Module } from '@nestjs/common';

import { ConfigModule } from './config.module';
import { ConfigService } from './config.service';
import { DatabaseModule } from './modules/dto/dto.modules';

@Module({
  imports: [
    // load configs from yaml
    ConfigModule,

    // connect database
    DatabaseModule,
  ],
  providers: [ConfigService],
})
export class PrimaryModule {}
