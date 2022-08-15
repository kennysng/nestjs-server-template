import { Unauthorized } from 'http-errors';
import { IMiddlewareArgs } from './interface';

export async function authentication({ request }: IMiddlewareArgs) {
  if (!request.user) throw new Unauthorized();
}

export async function sign({ reply, result }: IMiddlewareArgs) {
  // if (result.result.type === 'refresh')
  reply.header('Authorization', await reply.jwtSign(result.result));
}
