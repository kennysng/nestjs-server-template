import HttpStatus from 'http-status';

export interface IOption {
  statusCode?: number;
  parent?: Error;
}

export class HttpException extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(message);
  }
}

export class MyException extends HttpException {
  static e = {
    SQL_ERROR: new HttpException(
      'E500001',
      'SQL Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    ),
    ENTITY_NOT_FOUND: new HttpException(
      'E404001',
      'Entity not Found',
      HttpStatus.NOT_FOUND,
    ),
  };

  public static throw(func: string, e: Error, option: IOption = {}): never {
    if (e instanceof MyException) {
      throw e;
    } else if (e instanceof HttpException) {
      throw new MyException(func, e.code, e.message, {
        statusCode: option.statusCode || e.statusCode,
        parent: e,
      });
    } else {
      const statusCode = option?.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      throw new MyException(func, `E${statusCode}000`, e.message, {
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
    public readonly option: IOption = {},
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
