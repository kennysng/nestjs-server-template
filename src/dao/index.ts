import type { Options } from '../interface';
import type { BaseDao, MyModel } from './base';

export default [] as Array<
  [MyModel<any>, new (...args: any[]) => BaseDao<any>, Options?]
>;
