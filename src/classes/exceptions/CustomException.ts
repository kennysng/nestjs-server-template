import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomException extends HttpException {
  static exceptions = {
    SQL_ERROR: new CustomException('E500001', 'SQL Error'),
    ENTITY_NOT_FOUND: new CustomException('E400001', 'Entity not Found'),
  };

  public static throw(e: Error): CustomException {
    if (e instanceof CustomException) {
      throw e;
    } else if (e instanceof HttpException) {
      const statusCode = e.getStatus();
      throw new CustomException(
        `E${statusCode}000`,
        e.message,
        statusCode,
        e.stack,
      );
    } else {
      const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      throw new CustomException(
        `E${statusCode}000`,
        e.message,
        statusCode,
        e.stack,
      );
    }
  }

  constructor(
    public readonly errorCode: string,
    public readonly message: string,
    public readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly subStack?: string,
  ) {
    super(message, statusCode);
  }

  get stack(): string {
    if (!super.stack) return this.subStack;
    if (!this.subStack) return super.stack;
    return `${super.stack}\n${this.subStack}`;
  }
}
