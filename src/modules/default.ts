import type Queue = require('bee-queue');

import httpStatus = require('http-status');

import { IRequest, IResult } from '../interface';

export function process(queue: Queue) {
  queue.process(
    (job: Queue.Job<IRequest>, done: Queue.DoneCallback<IResult>) => {
      switch (true) {
        case job.data.method === 'HEALTH': {
          return done(null, {
            statusCode: httpStatus.OK,
          });
        }
        default: {
          return done(null, {
            statusCode: httpStatus.OK,
            result: 'Hello World!',
          });
        }
      }
    },
  );
}
