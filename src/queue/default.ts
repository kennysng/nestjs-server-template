import httpStatus = require('http-status');
import { Queue, Path, LastModified } from '../decorator';

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
      result: 'Hello World!',
    };
  }

  @Path('ALL')
  defaultPath() {
    return {
      statusCode: httpStatus.OK,
      result: 'Hello World!',
    };
  }
}
