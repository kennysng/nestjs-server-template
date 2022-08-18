import type Queue = require('bee-queue');

import httpStatus = require('http-status');

import { IRequest, IResult } from '../interface';

export function health(done: Queue.DoneCallback<IResult>) {
  return { statusCode: httpStatus.OK };
}

export function process(data: IRequest) {
  return {
    statusCode: httpStatus.OK,
    result: 'Hello World!',
  };
}
