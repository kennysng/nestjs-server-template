import type { IMiddlewareArgs, IUser } from './interface';

import { InternalServerError, Unauthorized } from 'http-errors';
import { Sequelize } from 'sequelize-typescript';
import { connect } from './sequelize';
import { sign } from 'jsonwebtoken';
import { DaoHelper } from './dao/base';

export const deviceTokenKey = 'x-device-token';

let sequelize: Sequelize | undefined;

// close DB connection
process.on('beforeExit', () => sequelize?.close());

declare module 'fastify' {
  interface FastifyRequest {
    daoHelper?: DaoHelper;
    payload?: IUser;
  }
}

export async function connectDB({ config, request }: IMiddlewareArgs) {
  if (!sequelize) sequelize = await connect(config, true);
  request.daoHelper = new DaoHelper(sequelize);
}

export async function authentication({ request }: IMiddlewareArgs) {
  if (!request.user) throw new Unauthorized();
}

export async function signJwt({ config, reply, result }: IMiddlewareArgs) {
  const payload = result.payload;
  if (!payload) throw new InternalServerError('Invalid Jwt Payload');
  const { secret, expires_in } = config.auth.refresh_token;
  const access_token = await reply.jwtSign(payload);
  const refresh_token = await sign(payload, secret, {
    expiresIn: expires_in,
  });

  reply.header('Authorization', `Bearer ${access_token}`);
  reply.header(deviceTokenKey, refresh_token);
}
