import { InternalServerError, Unauthorized } from 'http-errors';

import { IMiddlewareArgs } from './interface';

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
