import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { Sequelize } from 'sequelize-typescript';
import { DaoHelper } from './dao/base';
import { IJwtPayload, IMapper, IMasterConfig, IUser } from './interface';
import { connect } from './sequelize';
import type { Nullable } from './utils';
import { matchUrl, sign, verify } from './utils';
import { BadRequest, NotFound } from 'http-errors';
import fp from 'fastify-plugin';

const deviceTokenKey = 'x-device-token';
const refreshTokenKey = 'x-refresh-token';

let sequelize: Nullable<Sequelize>;

declare module 'fastify' {
  interface FastifyInstance {
    daoHelper?: DaoHelper;
  }
  interface FastifyRequest {
    start: number;
    device?: string;
    access?: string;
    refresh?: string;
    jwtPayload?: IJwtPayload;
    user?: IUser;
    mapper: IMapper;
  }
}

export default [
  fp(async function connectDB(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    if (!sequelize) sequelize = await connect(config, true);
    fastify.decorate('daoHelper', new DaoHelper(sequelize));
    next();
  }),
  fp(async function markElapsed(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    fastify.addHook('onRequest', (req, _, next) => {
      req.start = Date.now();
      next();
    });
    fastify.addHook<string>('onSend', (req, res, result, next) => {
      const result_ = JSON.parse(result);
      result_.elapsed = Date.now() - req.start;
      next(
        null,
        process.env.NODE_ENV === 'development'
          ? JSON.stringify(result_, null, 2)
          : JSON.stringify(result_),
      );
    });
    next();
  }),
  fp(async function getDeviceToken(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    fastify.addHook('onRequest', (req, _, next) => {
      req.device = req.headers[deviceTokenKey] as string;
      next();
    });
    next();
  }),
  fp(async function getAccessToken(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    fastify.addHook('onRequest', (req, _, next) => {
      if (req.headers.authorization) {
        req.access = req.headers.authorization.substring(7);
      }
      next();
    });
    next();
  }),
  fp(async function getRefreshToken(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    fastify.addHook('onRequest', (req, _, next) => {
      req.refresh = req.headers[refreshTokenKey] as string;
      next();
    });
    next();
  }),
  fp(async function mapUrl(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    fastify.addHook('onRequest', async (req) => {
      const url = new URL(req.url, `http://localhost:${config.port}`);
      const mapper = (req.mapper = matchUrl(req.method, url, ...config.mapper));
      if (!mapper) throw new NotFound();
    });
    next();
  }),
  fp(async function authenticate(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    fastify.addHook('onRequest', async (req) => {
      if (req.access && req.mapper.plugins?.find((p) => p === 'authenticate')) {
        if (!req.device) throw new BadRequest('Missing Device Token');
        req.jwtPayload = (await verify(
          req.access,
          config.auth.access_token.secret,
        )) as IJwtPayload;
      }
    });
    next();
  }),
  fp(async function signTokens(
    fastify: FastifyInstance,
    config: IMasterConfig,
    next: (err?: Error) => void,
  ) {
    fastify.addHook<string>('onSend', async (req, res, result) => {
      const result_ = JSON.parse(result);
      if (req.mapper.plugins?.find((p) => p === 'signTokens')) {
        const access = await sign(
          result_.result,
          config.auth.access_token.secret,
          {
            expiresIn: config.auth.access_token.expires_in,
          },
        );
        res.header('authorization', `Bearer ${access}`);

        const refresh = await sign(
          result_.result,
          config.auth.refresh_token.secret,
          {
            expiresIn: config.auth.refresh_token.expires_in,
          },
        );
        res.header(refreshTokenKey, refresh);
        result = JSON.stringify(result_);
      }
      return result;
    });
    next();
  }),
] as FastifyPluginCallback[];
