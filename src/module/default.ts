import httpStatus = require('http-status');

export function health() {
  return { statusCode: httpStatus.OK };
}

export function process() {
  return {
    statusCode: httpStatus.OK,
    result: 'Hello World!',
  };
}
