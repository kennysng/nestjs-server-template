import type { IRequest } from './interface';
import { NotFound } from 'http-errors';

import { fixUrl } from './utils';

type CheckUrl = (data: IRequest<any>) => boolean;

const registered: Record<
  string,
  Record<string, Array<[CheckUrl, (data: IRequest<any>) => any]>>
> = {};

export function Path(method: string, url: string | CheckUrl = '') {
  if (typeof url === 'string') {
    const url_ = url;
    url = ({ url: url__ }) => fixUrl(url_) === fixUrl(url__);
  }
  return function (
    target: any,
    propertyKey: string,
    // eslint-disable-next-line
    descriptor: TypedPropertyDescriptor<(...args: any[]) => any>,
  ) {
    // eslint-disable-next-line
    const func = descriptor.value!;
    if (!registered[target.constructor.name]) {
      registered[target.constructor.name] = {};
    }
    if (!registered[target.constructor.name][method]) {
      registered[target.constructor.name][method] = [];
    }
    registered[target.constructor.name][method].push([url as CheckUrl, func]);
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
        if (!registered[constructor.name][data.method]) {
          registered[constructor.name][data.method] = [];
        }
        return registered[constructor.name][data.method].find(([checkUrl]) =>
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
