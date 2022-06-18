import { HttpException, HttpStatus } from '@nestjs/common';

export interface ICustomExceptionOption {
  statusCode?: number;
  stack?: string;
}

export class CustomException extends HttpException {
  static exceptions = {
    SQL_ERROR: (func: string, option?: ICustomExceptionOption) =>
      new CustomException(func, 'E500001', 'SQL Error', option),
    ENTITY_NOT_FOUND: (func: string, option?: ICustomExceptionOption) =>
      new CustomException(func, 'E400001', 'Entity not Found', option),
  };

  public static throw(
    func: string,
    e: Error,
    option: ICustomExceptionOption = {},
  ): CustomException {
    if (e instanceof CustomException) {
      throw e;
    } else if (e instanceof HttpException) {
      throw new CustomException(func, `E${e.getStatus()}000`, e.message, {
        ...option,
        statusCode: e.getStatus(),
        stack: e.stack,
      });
    } else {
      const statusCode = option?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      throw new CustomException(func, `E${statusCode}000`, e.message, {
        ...option,
        statusCode,
        stack: e.stack,
      });
    }
  }

  constructor(
    public readonly func: string,
    public readonly errorCode: string,
    public readonly message: string,
    public readonly option?: ICustomExceptionOption,
  ) {
    super(message, option?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR);
  }

  get stack(): string {
    if (!this.option || !this.option.stack) return super.stack;
    return `${super.stack}\n${this.option.stack}`;
  }
}
