import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { Sequelize } from 'sequelize-typescript';
import { DaoHelper } from './dao/base';
import { IMasterConfig, IResult, IUser } from './interface';
import { connect } from './sequelize';
import { Nullable } from './utils';
import { BadRequest, Unauthorized } from 'http-errors';
import { sign } from 'jsonwebtoken';

const deviceTokenKey = 'x-device-token';
const refreshTokenKey = 'x-refresh-token';

let sequelize: Nullable<Sequelize>;

declare module 'fastify' {
  interface FastifyInstance {
    daoHelper?: DaoHelper;
  }
  interface FastifyRequest {
    payload?: IUser;
  }
}

export const connectDB: FastifyPluginCallback = async (
  fastify,
  options: IMasterConfig,
  next,
) => {
  if (!sequelize) sequelize = await connect(options, true);
  fastify.decorate('daoHelper', new DaoHelper(sequelize));
  next();
};

export const authentication: FastifyPluginCallback = async (
  fastify,
  options: IMasterConfig,
  next,
) => {
  fastify.decorateRequest('authenticate', async function authenticate() {
    const request: FastifyRequest = this; // eslint-disable-line

    const device = request.headers[deviceTokenKey];
    if (!device) throw new BadRequest('Missing Device Token');
    request.jwtVerify();
    if (!request.user) throw new Unauthorized();
  });
  fastify.decorateReply(
    'signTokens',
    async function signTokens({ result: payload }: IResult<any>) {
      const reply: FastifyReply = this; // eslint-disable-line

      const access_token = await reply.jwtSign(payload);
      reply.header('authorization', `Bearer ${access_token}`);

      const { secret, expires_in } = options.auth.refresh_token;
      const refresh_token = await sign(payload, secret, {
        expiresIn: expires_in,
      });
      reply.header(refreshTokenKey, refresh_token);
    },
  );
  next();
};
