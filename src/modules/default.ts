import type Queue = require('bee-queue');
import httpStatus = require('http-status');
import { Dependencies, IRequest, IResult } from 'src/interface';

export function process(queue: Queue, dependencies: Dependencies) {
  console.log('hi');
  queue.process(
    (job: Queue.Job<IRequest>, done: Queue.DoneCallback<IResult>) => {
      console.log('bye');
      return done(null, { code: httpStatus.OK, result: 'Hello World!' });
    },
  );
}
