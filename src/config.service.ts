import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';

import { IConfig } from 'src/interfaces/modules/config';

@Injectable()
export class ConfigService extends IConfig {
  private readonly config_: IConfig;

  constructor() {
    super();

    this.config_ = Object.freeze(
      yaml.load(
        readFileSync(
          join(
            __dirname,
            '..',
            '..',
            'configs',
            `${process.env.NODE_ENV}.yaml`,
          ),
          'utf8',
        ),
      ) as IConfig,
    );

    return new Proxy(this, {
      get: (_, p) => {
        return this.config_[p];
      },
    });
  }
}
