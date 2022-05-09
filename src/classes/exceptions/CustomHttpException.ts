import { HttpException } from '@nestjs/common';

export class CustomHttpException extends HttpException {
  constructor(private readonly error: Error, status: number) {
    super(error.message, status);
  }

  getError<T extends Error>(): T {
    return this.error as T;
  }
}
