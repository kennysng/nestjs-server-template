import type { ICache, IRequest, IResult } from './interface';

import { Forbidden, NotFound } from 'http-errors';

import { fixUrl } from './utils';
import { match } from 'node-match-path';
import { DateTime } from 'luxon';
import httpStatus from 'http-status';

type CheckData = (data: IRequest<any>) => boolean;
type PathFunction = (data: IRequest<any>) => IResult | Promise<IResult>;
type GetLastModified = () => Date | string | number;

const paths: Record<
  string,
  Record<string, Array<[CheckData, PathFunction]>>
> = {};

export function Guard(...guardFuncs: CheckData[]) {
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<PathFunction>,
  ) {
    const func = descriptor.value!;
    descriptor.value = async (data: IRequest<any>) => {
      const result = guardFuncs.reduce((r, f) => r && f(data), true);
      if (!result) throw new Forbidden();
      return await func.apply(this, [data]);
    };
  };
}

export function LastModified(getFunc: GetLastModified) {
  return async function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<PathFunction>,
  ) {
    const func = descriptor.value!;
    descriptor.value = async (data: IRequest<any>) => {
      const source = DateTime.fromHTTP(
        data.headers['if-modified-since'] as string,
      );
      let target: DateTime;
      const value: Date | string | number = await getFunc.apply(this, []);
      switch (typeof value) {
        case 'string':
          target = DateTime.fromISO(value);
          break;
        case 'number':
          target = DateTime.fromMillis(value);
          break;
        default:
          target = DateTime.fromJSDate(value);
          break;
      }
      if (target <= source) {
        return { statusCode: httpStatus.NOT_MODIFIED };
      }

      const result = await func.apply(this, [data]);
      result.cache = { lastModified: target.toHTTP() };
      return result;
    };
  };
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
      const result = await func.apply(this, [data]);
      return { ...result, cache: options };
    };
  };
}

export function Path(method: string, url: string | CheckData = '') {
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
    paths[target.constructor.name][METHOD].push([url as CheckData, func]);
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
        return await target[1].apply(this, [data]);
      }
    };
  };
}
