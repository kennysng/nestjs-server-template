import { Sequelize } from 'sequelize-typescript';
import { DaoHelper } from '../dao/base';
import { User, UserScope } from '../model/user.model';

import { Dependencies, IRequest } from '../interface';
import { UserDao } from 'src/dao/user';

import httpStatus = require('http-status');
import { Queue, Path } from '../decorator';
import { fixUrl } from 'src/utils';

@Queue('user')
export default class DefaultQueue {
  constructor(private readonly dependencies: Dependencies) {}

  get userDao() {
    return this.dependencies.get(DaoHelper).get<UserDao>(User);
  }

  @Path('HEALTH')
  async healthCheck(data: IRequest, dependencies: Dependencies) {
    const sequelize = dependencies.get(Sequelize);
    await sequelize.authenticate();
    return { statusCode: httpStatus.OK };
  }

  @Path('GET', 'profile')
  async getProfile({ user }: IRequest) {
    return {
      statusCode: 200,
      result: await this.userDao.findById(
        user?.id,
        user,
        undefined,
        UserScope.profile,
      ),
    };
  }

  @Path('PUT', ({ url }) => url.startsWith(fixUrl('/user/helper/')))
  async approveOrRejectHelper({ params, user }) {
    return {
      statusCode: 200,
      result: await this.userDao.approveOrRejectHelper(
        +params.requestId,
        params.action,
        user,
      ),
    };
  }
}
