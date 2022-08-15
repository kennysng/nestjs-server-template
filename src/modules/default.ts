import type Queue = require('bee-queue');
import httpStatus = require('http-status');
import { Dependencies, IRequest, IResult } from '../interface';

export function process(queue: Queue, dependencies: Dependencies) {
  queue.process((job: Queue.Job<IRequest>, done: Queue.DoneCallback<IResult>) =>
    done(null, {
      code: httpStatus.OK,
      result: 'Hello World!',
    }),
  );
}
