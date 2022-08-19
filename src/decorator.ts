import { IRequest } from './interface';
import { NotFound } from 'http-errors';

type GetUrl = (data: IRequest<any>) => string;

const registered: Record<
  string,
  Record<string, Array<[GetUrl, (data: IRequest<any>) => any]>>
> = {};

function fixUrl(url: string) {
  if (!url.startsWith('/')) url = '/' + url;
  while (url.endsWith('/')) url = url.substring(0, url.length - 1);
  return url;
}

export function Path(method: string, url: string | GetUrl = () => '') {
  if (typeof url === 'string') url = () => (url || '') as string;
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
    registered[target.constructor.name][method].push([url as GetUrl, func]);
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
      readonly name: string;

      constructor(...args: any[]) {
        super(...args);
        this.name = super.constructor.name;
      }

      find(data: IRequest) {
        const target = fixUrl(data.url);
        if (!registered[this.name][data.method]) {
          registered[this.name][data.method] = [];
        }
        return registered[this.name][data.method].find(([getUrl]) => {
          const url = fixUrl(getUrl(data));
          return url === target;
        });
      }

      async run(data: IRequest<any>) {
        const target = this.find(data) || this.find({ ...data, method: 'ALL' });
        if (!target) throw new NotFound();
        return await target[1](data);
      }
    };
  };
}
