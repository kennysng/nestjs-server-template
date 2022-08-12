import Queue, { Job } from 'bee-queue';
import fastify from 'fastify';
import compression from '@fastify/compress';
import helmet from '@fastify/helmet';
import yaml from 'js-yaml';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { IConfig, IResult } from 'interface';
import { v4 } from 'uuid';

async function main() {
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
  const content = await readFile(
    resolve('configs', `${process.env.NODE_ENV}.yaml`),
    'utf8',
  );
  const config: IConfig = yaml.load(content);

  const queue = new Queue('');  // TODO

  const app = fastify({ logger: true });
  app.register(helmet);
  app.register(compression);
  app.all('*', async (request, reply) => {
    const job = queue.createJob({
      // TODO
    });
    await job.save();
    job.on('succeeded', (result: IResult) => {
      reply.send(result);
    });
  });
}

main();
