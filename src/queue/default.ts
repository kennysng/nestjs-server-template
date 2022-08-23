import httpStatus = require('http-status');

import { HeaderValidate, LastModified, Path, Queue } from '../decorator';

let date: Date;

@Queue()
export default class DefaultQueue {
  @Path('HEALTH')
  healthCheck() {
    return { statusCode: httpStatus.OK };
  }

  @LastModified(() => {
    if (!date) date = new Date();
    return date;
  })
  @Path('GET', 'cached')
  cachedPath() {
    return {
      statusCode: httpStatus.OK,
      result: 'Hello LastModified!',
    };
  }

  @HeaderValidate('x-hi-hi', 'Header')
  @Path('GET', 'validate')
  errorPath() {
    return {
      statusCode: httpStatus.OK,
      result: 'Hello Validate!',
    };
  }

  @Path('ALL')
  defaultPath() {
    return {
      statusCode: httpStatus.OK,
      result: 'Hello Default!',
    };
  }
}
