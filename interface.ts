import { HttpStatus } from 'http-status';

export interface IConfig {
  // TODO
}

export interface IResult {
  code: HttpStatus;
  result: any;
}
