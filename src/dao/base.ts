import type { IUser, Options } from '../interface';
import type {
  FindOptions,
  Includeable,
  Transaction,
  WhereOptions,
} from 'sequelize';

import capitalize from 'capitalize';
import deepmerge from 'deepmerge';
import { EventEmitter } from 'events';
import { InternalServerError, NotFound } from 'http-errors';
import { Logger } from 'pino';
import { Model, Sequelize } from 'sequelize-typescript';

import logger from '../logger';
import { inTransaction, logSection } from '../utils';

// eslint-disable-next-line
type MyModel<T> = { new(): T } & typeof Model;

export class DaoHelper {
  private readonly daos: Record<string, BaseDao<any>> = {};

  constructor(private readonly sequelize: Sequelize) {}

  get<T>(model: MyModel<T>) {
    if (!this.daos[model.constructor.name]) {
      this.daos[model.constructor.name] = new BaseDao(this.sequelize, model);
    }
    return this.daos[model.constructor.name];
  }
}

export class BaseDao<T extends Model, ID = number> extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly defaultInclude: Includeable[];
  protected readonly deleteMode: 'deletedAt' | 'destroy';

  constructor(
    protected readonly sequelize: Sequelize,
    protected readonly model: { new(): T } & typeof Model, // eslint-disable-line prettier/prettier
    options?: Options,
  ) {
    super();

    this.logger = options?.logger || logger(this.constructor.name);
    this.defaultInclude = options?.defaultInclude || [];
    this.deleteMode = options?.deleteMode || 'deletedAt';

    this.on('beforeCreate', (instances) => {
      for (const i of instances) {
        this.logger.debug(`.create ${this.toString(i)}`);
      }
    });
    this.on('beforeUpdate', (instances) => {
      for (const i of instances) {
        this.logger.debug(`.update ${this.toString(i)}`);
      }
    });
    this.on('beforeDestroy', (instances) => {
      for (const i of instances) {
        this.logger.debug(`.destroy ${this.toString(i)}`);
      }
    });
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  /* eslint-disable @typescript-eslint/no-empty-function */
  /**
   * create relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   * @param user IUser
   */
  protected async createRelationships(
    instances: T[],
    transaction: Transaction,
    user?: IUser,
  ) {}

  /**
   * update relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   * @param user IUser
   */
  protected async updateRelationships(
    instances: T[],
    transaction: Transaction,
    user?: IUser,
  ) {}

  /**
   * delete relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   * @param user IUser
   */
  protected async deleteRelationships(
    instances: T[],
    transaction: Transaction,
    user?: IUser,
  ) {}
  /* eslint-enable @typescript-eslint/no-unused-vars */
  /* eslint-enable @typescript-eslint/no-empty-function */

  public on(
    event: 'beforeSave',
    callback: (
      type: 'create' | 'update',
      instances: T[],
      user?: IUser,
    ) => void | Promise<void>,
  );
  public on(
    event: 'afterSave',
    callback: (
      type: 'create' | 'update',
      instances: T[],
      created?: T[],
      user?: IUser,
    ) => void | Promise<void>,
  );
  public on(
    event: 'beforeCreate',
    callback: (instances: T[], user?: IUser) => void | Promise<void>,
  );
  public on(
    event: 'afterCreate',
    callback: (
      instances: T[],
      created?: T[],
      user?: IUser,
    ) => void | Promise<void>,
  );
  public on(
    event: 'afterFind',
    callback: (instances: T[], user?: IUser) => void | Promise<void>,
  );
  public on(
    event: 'beforeUpdate',
    callback: (instances: T[], user?: IUser) => void | Promise<void>,
  );
  public on(
    event: 'afterUpdate',
    callback: (instances: T[], user?: IUser) => void | Promise<void>,
  );
  public on(
    event: 'beforeDestroy',
    callback: (instances: T[], user?: IUser) => void | Promise<void>,
  );
  public on(
    event: 'afterDestroy',
    callback: (instances: T[], user?: IUser) => void | Promise<void>,
  );
  public on(event: string, callback: (...args: any[]) => void | Promise<void>) {
    super.on(event, callback);
    return this;
  }

  public getPrimaryKey(instance: T) {
    let id: ID | undefined = instance.id;
    if (!id) {
      id =
        (typeof instance.getDataValue === 'function' &&
          instance.getDataValue('id')) ||
        undefined;
    }
    if (!id) {
      id = instance['dataValues']?.id;
    }
    return id;
  }

  public inTransaction<T>(
    callback: (transaction: Transaction) => Promise<T>,
    transaction?: Transaction,
  ): Promise<T> {
    return inTransaction(this.sequelize, callback, transaction);
  }

  /**
   * create instance
   * @param instance Partial<T>
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @param options sequelize.FindOptions
   * @returns T
   */
  async create(
    instance: Partial<T>,
    user?: IUser,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T>;
  /**
   * create instances
   * @param instance Array<Partial<T>>
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @param options sequelize.FindOptions
   * @returns T[]
   */
  async create(
    instances: Array<Partial<T>>,
    user?: IUser,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T[]>;
  async create(
    instances: Partial<T> | Array<Partial<T>>,
    user?: IUser,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T | T[]> {
    if (!transaction) {
      return this.inTransaction(async (transaction) =>
        Array.isArray(instances)
          ? this.create(instances, user, transaction, options)
          : this.create(instances, user, transaction, options),
      );
    } else {
      // fix return type
      let isSingle = false;
      if (!Array.isArray(instances)) {
        isSingle = true;
        instances = [instances];
      }

      // skip if empty
      if (!instances.length) return [];

      // assign createdAt
      for (const instance of instances) {
        instance['createdAt'] = new Date();
        instance['creator'] = instance['updater'] = { id: user.id };
      }

      // create
      await this.emit('beforeSave', 'create', instances, user);
      await this.emit('beforeCreate', instances, user);
      const result = (await this.model.bulkCreate(instances, {
        transaction,
      })) as unknown as T[];
      for (let i = 0, length = instances.length; i < length; i += 1) {
        Object.assign(result[i], instances[i]);
      }
      await this.emit('afterSave', 'create', instances, result, user);
      await this.emit('afterCreate', instances, result, user);

      // create relationships
      await logSection('createRelationships', this.logger, () => {
        return this.createRelationships(result, transaction, user);
      });

      // find
      if (isSingle) {
        if (options) {
          try {
            return this.findById(
              this.getPrimaryKey(result[0]) as ID,
              user,
              transaction,
              options,
            );
          } catch (e) {
            throw new InternalServerError(capitalize.words(e.message));
          }
        } else {
          return result[0];
        }
      } else if (options) {
        return this.find(
          {
            where: {
              id: result.map((i) => this.getPrimaryKey(i)),
            } as WhereOptions<T>,
            ...(options || {}),
          },
          user,
          transaction,
        );
      } else {
        return result;
      }
    }
  }

  /**
   * find multiple instances
   * @param options sequelize.FindOptions<T>
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @param scope string
   * @returns T[]
   */
  async find(
    options: FindOptions<T>,
    user?: IUser,
    transaction?: Transaction,
    scope?: string,
  ): Promise<T[]> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.find(options, user, transaction, scope),
      );
    } else {
      options.include = this.defaultInclude;
      options.transaction = transaction;
      const model_ = scope ? this.model.scope(scope) : this.model;
      const result = (await model_.findAll(options)) as unknown as T[];
      if (result.length) await this.emit('afterFind', result, user);
      return result;
    }
  }

  /**
   * find one instance
   * @param options sequelize.FindOptions<T>
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @param scope string
   * @returns T
   */
  async findOne(
    options: FindOptions<T>,
    user?: IUser,
    transaction?: Transaction,
    scope?: string,
  ): Promise<T> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.findOne(options, user, transaction, scope),
      );
    } else {
      options.include = this.defaultInclude;
      options.transaction = transaction;
      const model_ = scope ? this.model.scope(scope) : this.model;
      const result = (await model_.findOne(options)) as T;
      if (result) await this.emit('afterFind', [result], user);
      return result;
    }
  }

  /**
   * find instance by id
   * @param id whether number or string
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @param options sequelize.FindOptions<T>
   * @param scope string
   * @returns T
   */
  async findById(
    id: ID,
    user?: IUser,
    transaction?: Transaction,
    scope?: string,
  ): Promise<T>;
  async findById(
    id: ID,
    user?: IUser,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T>;
  async findById(
    id: ID,
    user?: IUser,
    transaction?: Transaction,
    optionsOrScope?: FindOptions<T> | string,
  ): Promise<T> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        typeof optionsOrScope === 'string'
          ? this.findById(id, user, transaction, optionsOrScope)
          : this.findById(id, user, transaction, optionsOrScope),
      );
    } else {
      const model_ =
        typeof optionsOrScope === 'string'
          ? this.model.scope(optionsOrScope)
          : this.model;
      const options: FindOptions<T> =
        (typeof optionsOrScope !== 'string' && optionsOrScope) || {};
      options.where = deepmerge<WhereOptions<T>>(options.where || {}, {
        id,
      } as WhereOptions<T>);
      options.include = this.defaultInclude;
      options.transaction = options.transaction || transaction;
      const result = (await model_.findOne(options)) as T;
      if (!result) {
        throw new NotFound(`${this.model.constructor.name} Not Found`);
      }
      await this.emit('afterFind', [result], user);
      return result;
    }
  }

  /**
   * update instance
   * @param instance T
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @returns T
   */
  async update(
    instance: T,
    user?: IUser,
    transaction?: Transaction,
  ): Promise<T>;
  /**
   * update instances
   * @param instance T[]
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @returns T[]
   */
  async update(
    instances: T[],
    user?: IUser,
    transaction?: Transaction,
  ): Promise<T[]>;
  async update(
    instances: T | T[],
    user?: IUser,
    transaction?: Transaction,
  ): Promise<T | T[]> {
    if (!transaction) {
      return this.inTransaction(async (transaction) =>
        Array.isArray(instances)
          ? this.update(instances, user, transaction)
          : this.update(instances, user, transaction),
      );
    } else if (Array.isArray(instances)) {
      // skip if empty
      if (!instances.length) return [];

      // create or update (note no delete)
      const newInstances = instances.filter((i) => !this.getPrimaryKey(i));
      const existingInst = instances.filter((i) => this.getPrimaryKey(i));

      // assign updatedAt
      for (const instance of existingInst) {
        instance['updatedAt'] = new Date();
        instance['updater'] = { id: user.id };
      }

      if (existingInst.length) {
        await this.emit('beforeSave', 'update', existingInst, user);
        await this.emit('beforeUpdate', existingInst, user);
      }
      const [created] = await Promise.all([
        this.create(newInstances, user, transaction),
        ...existingInst.map(
          async (i) =>
            await this.model.update(i, {
              where: { id: this.getPrimaryKey(i) } as WhereOptions<T>,
              transaction,
            }),
        ),
      ]);
      if (existingInst.length) {
        await this.emit('afterSave', 'update', existingInst, user);
        await this.emit('afterUpdate', existingInst, user);

        // update relationships
        await logSection('updateRelationships', this.logger, () =>
          this.updateRelationships(existingInst, transaction, user),
        );
      }

      return this.find(
        {
          where: {
            id: [...created, ...existingInst].map((i) => this.getPrimaryKey(i)),
          } as WhereOptions<T>,
        },
        user,
        transaction,
      );
    } else if (!this.getPrimaryKey(instances)) {
      return this.create(instances, user, transaction);
    } else {
      instances['updatedAt'] = new Date();
      instances['updater'] = { id: user.id };

      await this.emit('beforeSave', 'update', [instances], user);
      await this.emit('beforeUpdate', [instances], user);
      await this.model.update(instances, {
        where: { id: this.getPrimaryKey(instances) } as WhereOptions<T>,
        transaction,
      });
      await this.emit('afterSave', 'update', [instances], user);
      await this.emit('afterUpdate', [instances], user);

      // update relationships
      await logSection('updateRelationships', this.logger, () =>
        this.updateRelationships([instances], transaction, user),
      );

      return this.findById(this.getPrimaryKey(instances), user, transaction);
    }
  }

  /**
   * delete multiple instances
   * @param instances T[]
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @returns T[]
   */
  async delete(
    instances: T[],
    user?: IUser,
    transaction?: Transaction,
  ): Promise<T[]> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.delete(instances, user, transaction),
      );
    } else if (!instances.length) {
      return [];
    } else {
      const targets = await this.find(
        {
          where: {
            id: instances.map((i) => this.getPrimaryKey(i)).filter((id) => id),
          } as WhereOptions<T>,
        },
        user,
        transaction,
      );
      for (const instance of instances) {
        instance['deletedAt'] = new Date();
        instance['deleter'] = { id: user.id };
      }

      if (this.deleteMode === 'deletedAt') {
        if (instances.length) {
          await this.emit('beforeDestroy', instances, user);
          await Promise.all(
            instances.map(
              async (i) =>
                await this.model.update(i, {
                  where: { id: this.getPrimaryKey(i) } as WhereOptions<T>,
                  transaction,
                }),
            ),
          );
          await this.emit('afterDestroy', instances, user);
        }
      } else if (instances.length) {
        await this.emit('beforeDestroy', instances, user);
        await this.model.destroy({
          where: {
            id: targets.map((i) => this.getPrimaryKey(i)),
          } as WhereOptions<T>,
          transaction,
        });
        await this.emit('afterDestroy', instances, user);
      }

      if (instances.length) {
        // delete relationships
        await logSection('deleteRelationships', this.logger, () =>
          this.deleteRelationships(instances, transaction),
        );
      }

      return this.deleteMode === 'deletedAt' ? instances : targets;
    }
  }

  /**
   * delete instance by id
   * @param id whether number or string
   * @param user IUser
   * @param transaction sequelize.Transaction
   * @returns T
   */
  async deleteById(
    id: ID,
    user?: IUser,
    transaction?: Transaction,
  ): Promise<T> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.deleteById(id, user, transaction),
      );
    } else {
      let target: T;
      try {
        target = await this.findById(id, user, transaction);
      } catch (e) {
        throw new InternalServerError(capitalize.words(e.message));
      }
      target['deletedAt'] = new Date();
      target['deleter'] = { id: user.id };

      await this.emit('beforeDestroy', [target], user);
      if (this.deleteMode === 'deletedAt') {
        await this.model.update(target, {
          where: { id } as WhereOptions<T>,
          transaction,
        });
      } else {
        await this.model.destroy({
          where: { id } as WhereOptions<T>,
          transaction,
        });
      }
      await this.emit('afterDestroy', [target], user);

      // delete relationships
      await logSection('deleteRelationships', this.logger, () =>
        this.deleteRelationships([target], transaction),
      );

      return target;
    }
  }

  public toJSON(instance: T) {
    return instance;
  }

  public toString(instance: T) {
    return JSON.stringify(this.toJSON(instance));
  }
}
