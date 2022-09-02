import type { Options } from '../interface';
import type { BaseDao, DaoHelper, MyModel } from './base';

import { Sequelize } from 'sequelize-typescript';

export default [] as Array<
  [
    MyModel<any>,
    new (
      sequelize: Sequelize,
      daoHelper: DaoHelper,
      options?: Options,
    ) => BaseDao<any>,
    Options?,
  ]
>;
