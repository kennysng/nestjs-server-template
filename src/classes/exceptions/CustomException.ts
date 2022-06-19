import { HttpException, HttpStatus } from '@nestjs/common';

export interface ICustomExceptionOption {
  statusCode?: number;
  stack?: string;
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
  static exceptions: Record<string, BaseCustomException> = {
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
  ): CustomException {
    if (e instanceof CustomException) {
      throw e;
    } else if (e instanceof BaseCustomException) {
      throw new CustomException(e);
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

  private readonly option?: ICustomExceptionOption;

  constructor(error: BaseCustomException);
  constructor(
    func: string,
    code: string,
    message: string,
    option?: ICustomExceptionOption,
  );
  constructor(...args: any[]) {
    super(
      args[1] ? args[1] : (args[0] as BaseCustomException).code,
      args[2] ? args[2] : (args[0] as BaseCustomException).message,
      args[3]
        ? args[3]?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
        : (args[0] as BaseCustomException).statusCode,
    );
    this.option = args[3];
  }

  get stack(): string {
    if (!this.option || !this.option.stack) return super.stack;
    return `${super.stack}\n${this.option.stack}`;
  }
}
