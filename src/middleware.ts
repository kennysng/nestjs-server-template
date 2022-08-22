import type { IMiddlewareArgs } from './interface';

import { InternalServerError, Unauthorized } from 'http-errors';
import { Sequelize } from 'sequelize-typescript';
import { connect } from './sequelize';

let sequelize: Sequelize | undefined;

declare module 'fastify' {
  interface FastifyRequest {
    sequelize?: Sequelize;
  }
}

export async function connectDB({ config, request }: IMiddlewareArgs) {
  if (!sequelize) sequelize = await connect(config, true);
  request.sequelize = sequelize;
}

export async function authentication({ request }: IMiddlewareArgs) {
  if (!request.user) throw new Unauthorized();
}

export async function sign({ reply, result }: IMiddlewareArgs) {
  const { type, payload } = result.result;
  if (!type || !payload) throw new InternalServerError('Invalid Jwt Payload');
  reply.header(
    type === 'refresh' ? 'x-refresh-token' : 'Authorization',
    await reply.jwtSign(payload),
  );
}
