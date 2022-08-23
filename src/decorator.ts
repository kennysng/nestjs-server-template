import type { IBodyRequest, ICache, IRequest, IResult } from './interface';

import { Forbidden, NotFound } from 'http-errors';

import { fixUrl, Nullable, ValidationError } from './utils';
import { match } from 'node-match-path';
import { DateTime } from 'luxon';
import httpStatus = require('http-status');
import words = require('lodash.words');
import capitalize = require('capitalize');

type CheckFunc<T> = (data: IRequest<any>) => void | T;
type PathFunction = (data: IRequest<any>) => IResult | Promise<IResult>;

/* eslint-disable */
type GetLastModified = (data: IRequest<any>) =>
  | Date
  | string
  | number
  | Promise<Date | string | number>;
/* eslint-enable */

const paths: Record<
  string,
  Record<
    string,
    Array<[CheckFunc<boolean>, TypedPropertyDescriptor<PathFunction>]>
  >
> = {};

export function BodyValidate(field: string, name?: string) {
  return Validate(
    ({ body }: IBodyRequest) =>
      !body[field] &&
      `Missing ${name || capitalize.words(words(field).join(' '))}`,
  );
}

export function HeaderValidate(field: string, name?: string) {
  return Validate(
    ({ headers }) =>
      !headers[field] &&
      `Missing ${name || capitalize.words(words(field).join(' '))}`,
  );
}

export function Validate(...funcs: CheckFunc<Nullable<string>>[]) {
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<PathFunction>,
  ) {
    const func = descriptor.value!;
    descriptor.value = async (data: IRequest<any>) => {
      const result: string[] = funcs.reduce((r, f) => {
        const result = f(data);
        return result ? [...r, result] : r;
      }, []);
      if (result.length) throw new ValidationError(result);
      return await func.apply(this, [data]);
    };
  };
}

export function Guard(...funcs: CheckFunc<boolean>[]) {
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<PathFunction>,
  ) {
    const func = descriptor.value!;
    descriptor.value = async (data: IRequest<any>) => {
      const result = funcs.reduce((r, f) => r && (f(data) || true), true);
      if (!result) throw new Forbidden();
      return (await func.apply(this, [data])) as IResult<any>;
    };
  };
}

export function LastModified(getFunc: GetLastModified) {
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<PathFunction>,
  ) {
    const func = descriptor.value!;
    descriptor.value = async (data: IRequest<any>) => {
      let target: DateTime;
      const value: Date | string | number = await getFunc.apply(this, [data]);
      switch (typeof value) {
        case 'string':
          target = DateTime.fromHTTP(DateTime.fromISO(value).toHTTP());
          break;
        case 'number':
          target = DateTime.fromHTTP(DateTime.fromMillis(value).toHTTP());
          break;
        default:
          target = DateTime.fromHTTP(DateTime.fromJSDate(value).toHTTP());
          break;
      }

      if (data.headers['if-modified-since']) {
        const source = DateTime.fromHTTP(
          data.headers['if-modified-since'] as string,
        );
        if (target <= source) {
          return { statusCode: httpStatus.NOT_MODIFIED };
        }
      }

      const result: IResult<any> = await func.apply(this, [data]);
      result.cache = Object.assign(result.cache || {}, {
        lastModified: target.toHTTP(),
      });
      return result;
    };
  };
}

export function Public() {
  return Cache({ private: false });
}

export function Private() {
  return Cache({ private: true });
}

export function MaxAge(maxAge: number) {
  return Cache({ maxAge });
}

export function NoCache() {
  return Cache({ noCache: true });
}

export function NoStore() {
  return Cache({ noStore: true });
}

export function Cache(options: ICache) {
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<PathFunction>,
  ) {
    const func = descriptor.value!;
    descriptor.value = async (data: IRequest<any>) => {
      const result: IResult<any> = await func.apply(this, [data]);
      result.cache = Object.assign(result.cache || {}, options);
      return result;
    };
  };
}

export function Path(method: string, url: string | CheckFunc<boolean> = '') {
  if (typeof url === 'string') {
    const url_ = url;
    url = ({ url: url__ }) => !!match(fixUrl(url_), fixUrl(url__));
  }
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<PathFunction>,
  ) {
    // eslint-disable-next-line
    const func = descriptor.value!;
    if (!paths[target.constructor.name]) {
      paths[target.constructor.name] = {};
    }
    const METHOD = method.toLocaleUpperCase();
    if (!paths[target.constructor.name][METHOD]) {
      paths[target.constructor.name][METHOD] = [];
    }
    paths[target.constructor.name][METHOD].push([
      url as CheckFunc<boolean>,
      descriptor,
    ]);
  };
}

// eslint-disable-next-line
export function Queue<T extends { new(...args: any[]): any }>(baseUrl = '') {
  return (constructor: T) => {
    // fix base url
    if (baseUrl) {
      if (!baseUrl.startsWith('/')) baseUrl = `/${baseUrl}`;
      while (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.substring(0, baseUrl.length - 1);
      }
    }

    return class extends constructor {
      find(data: IRequest) {
        if (!paths[constructor.name][data.method]) {
          paths[constructor.name][data.method] = [];
        }
        return paths[constructor.name][data.method].find(([checkUrl]) =>
          checkUrl({ ...data, url: fixUrl(data.url) }),
        );
      }

      async run(data: IRequest<any>) {
        const target = this.find(data) || this.find({ ...data, method: 'ALL' });
        if (!target) throw new NotFound();
        return await target[1].value!.apply(this, [data]);
      }
    };
  };
}
