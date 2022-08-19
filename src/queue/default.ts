import httpStatus = require('http-status');
import { Queue, Path } from '../decorator';

@Queue()
export default class DefaultQueue {
  @Path('HEALTH')
  healthCheck() {
    return { statusCode: httpStatus.OK };
  }

  @Path('ALL')
  defaultPath() {
    return {
      statusCode: httpStatus.OK,
      result: 'Hello World!',
    };
  }
}
