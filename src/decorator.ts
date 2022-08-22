import type { IRequest } from './interface';

import { Forbidden, NotFound } from 'http-errors';

import { fixUrl } from './utils';
import { match } from 'node-match-path';

type CheckData = (data: IRequest<any>) => boolean;

const paths: Record<
  string,
  Record<string, Array<[CheckData, (data: IRequest<any>) => any]>>
> = {};

export function Guard(...guardFuncs: CheckData[]) {
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<(data: IRequest<any>) => any>,
  ) {
    const func = descriptor.value;
    descriptor.value = (data: IRequest<any>) => {
      const result = guardFuncs.reduce((r, f) => r && f(data), true);
      if (!result) throw new Forbidden();
      if (func) func(data);
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
    descriptor: TypedPropertyDescriptor<(...args: any[]) => any>,
  ) {
    // eslint-disable-next-line
    const func = descriptor.value!;
    if (!paths[target.constructor.name]) {
      paths[target.constructor.name] = {};
    }
    if (!paths[target.constructor.name][method]) {
      paths[target.constructor.name][method] = [];
    }
    paths[target.constructor.name][method].push([url as CheckData, func]);
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
