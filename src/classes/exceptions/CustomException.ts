import { HttpException, HttpStatus } from '@nestjs/common';

export interface ICustomExceptionOption {
  statusCode?: number;
  parent?: Error;
}

export class BaseCustomException extends HttpException {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(message, statusCode);
  }
}

export class CustomException extends BaseCustomException {
  static e = {
    SQL_ERROR: new BaseCustomException(
      'E500001',
      'SQL Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    ),
    ENTITY_NOT_FOUND: new BaseCustomException(
      'E404001',
      'Entity not Found',
      HttpStatus.NOT_FOUND,
    ),
  };

  public static throw(
    func: string,
    e: Error,
    option: ICustomExceptionOption = {},
  ): never {
    if (e instanceof CustomException) {
      throw e;
    } else if (e instanceof BaseCustomException) {
      throw new CustomException(func, e.code, e.message, {
        statusCode: e.statusCode,
        parent: e,
      });
    } else if (e instanceof HttpException) {
      throw new CustomException(func, `E${e.getStatus()}000`, e.message, {
        ...option,
        statusCode: e.getStatus(),
        parent: e,
      });
    } else {
      const statusCode = option?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      throw new CustomException(func, `E${statusCode}000`, e.message, {
        ...option,
        statusCode,
        parent: e,
      });
    }
  }

  constructor(
    public readonly func: string,
    public readonly code: string,
    public readonly message: string,
    public readonly option: ICustomExceptionOption = {},
  ) {
    super(
      code,
      message + (option.parent ? ` - Thrown by ${option.parent.message}` : ''),
      option.statusCode,
    );
  }

  get stack(): string {
    let stack = '';
    if (this.option.parent) stack += `${this.option.parent.stack}\n`;
    stack += super.stack;
    return stack;
  }
}
