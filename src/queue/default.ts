import httpStatus = require('http-status');

import { Path, Queue } from '../decorator';

@Queue()
export default class DefaultQueue {
  @Path('HEALTH')
  healthCheck() {
    return { statusCode: httpStatus.OK };
  }

  @Path('GET', 'test')
  testPath() {
    return {
      statusCode: httpStatus.OK,
      result: 'Hello, Test!',
    };
  }

  @Path('ALL')
  defaultPath() {
    return {
      statusCode: httpStatus.OK,
      result: 'Hello, World!',
    };
  }
}
