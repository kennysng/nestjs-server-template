import type {
  FindOptions,
  Includeable,
  Transaction,
  WhereOptions,
} from 'sequelize';

import deepmerge from 'deepmerge';
import EventEmitter from 'events';
import { NotFound } from 'http-errors';
import { Logger } from 'pino';
import { Model, Sequelize } from 'sequelize-typescript';

import { Options } from './interface';
import { inTransaction, logSection } from './utils';
import logger from './logger';

export class BaseDao<T extends Model, ID = number> extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly defaultInclude: Includeable[];
  protected readonly deleteMode: 'deletedAt' | 'destroy';

  constructor(
    protected sequelize: Sequelize,
    protected readonly model: { new(): T } & typeof Model,  // eslint-disable-line prettier/prettier
    options?: Options,
  ) {
    super();

    this.logger = options?.logger || logger(this.constructor.name);
    this.defaultInclude = options?.defaultInclude || [];
    this.deleteMode = options?.deleteMode || 'deletedAt';

    this.on('beforeCreate', (instances) => {
      for (const i of instances) {
        this.logger.debug({ entity: this.toJSON(i) }, 'create');
      }
    });
    this.on('beforeUpdate', (instances) => {
      for (const i of instances) {
        this.logger.debug({ entity: this.toJSON(i) }, 'update');
      }
    });
    this.on('beforeDestroy', (instances) => {
      for (const i of instances) {
        this.logger.debug({ entity: this.toJSON(i) }, 'destroy');
      }
    });
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  /* eslint-disable @typescript-eslint/no-empty-function */
  /**
   * create relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   */
  protected async createRelationships(
    instances: T[],
    transaction: Transaction,
  ) {}

  /**
   * update relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   */
  protected async updateRelationships(
    instances: T[],
    transaction: Transaction,
  ) {}

  /**
   * delete relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   */
  protected async deleteRelationships(
    instances: T[],
    transaction: Transaction,
  ) {}
  /* eslint-enable @typescript-eslint/no-unused-vars */
  /* eslint-enable @typescript-eslint/no-empty-function */

  public on(
    event: 'beforeSave',
    callback: (
      type: 'create' | 'update',
      instances: T[],
    ) => void | Promise<void>,
  );
  public on(
    event: 'afterSave',
    callback: (
      type: 'create' | 'update',
      instances: T[],
      created?: T[],
    ) => void | Promise<void>,
  );
  public on(
    event: 'beforeCreate',
    callback: (instances: T[]) => void | Promise<void>,
  );
  public on(
    event: 'afterCreate',
    callback: (instances: T[], created?: T[]) => void | Promise<void>,
  );
  public on(
    event: 'afterFind',
    callback: (instances: T[]) => void | Promise<void>,
  );
  public on(
    event: 'beforeUpdate',
    callback: (instances: T[]) => void | Promise<void>,
  );
  public on(
    event: 'afterUpdate',
    callback: (instances: T[]) => void | Promise<void>,
  );
  public on(
    event: 'beforeDestroy',
    callback: (instances: T[]) => void | Promise<void>,
  );
  public on(
    event: 'afterDestroy',
    callback: (instances: T[]) => void | Promise<void>,
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
   * @param transaction sequelize.Transaction
   * @param options sequelize.FindOptions
   * @returns T
   */
  async create(
    instance: Partial<T>,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T>;
  /**
   * create instances
   * @param instance Array<Partial<T>>
   * @param transaction sequelize.Transaction
   * @param options sequelize.FindOptions
   * @returns T[]
   */
  async create(
    instances: Array<Partial<T>>,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T[]>;
  async create(
    instances: Partial<T> | Array<Partial<T>>,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T | T[]> {
    if (!transaction) {
      return this.inTransaction(async (transaction) =>
        Array.isArray(instances)
          ? this.create(instances, transaction, options)
          : this.create(instances, transaction, options),
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
      }

      // create
      await this.emit('beforeSave', 'create', instances);
      await this.emit('beforeCreate', instances);
      const result = (await this.model.bulkCreate(instances, {
        transaction,
      })) as unknown as T[];
      for (let i = 0, length = instances.length; i < length; i += 1) {
        Object.assign(result[i], instances[i]);
      }
      await this.emit('afterSave', 'create', instances, result);
      await this.emit('afterCreate', instances, result);

      // create relationships
      await logSection('createRelationships', this.logger, () => {
        return this.createRelationships(result, transaction);
      });

      // find
      if (isSingle) {
        if (options) {
          return this.findById(
            this.getPrimaryKey(result[0]) as ID,
            transaction,
            options,
          );
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
   * @param transaction sequelize.Transaction
   * @param scope string
   * @returns T[]
   */
  async find(
    options: FindOptions<T>,
    transaction?: Transaction,
    scope?: string,
  ): Promise<T[]> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.find(options, transaction, scope),
      );
    } else {
      options.include = this.defaultInclude;
      options.transaction = transaction;
      const model_ = scope ? this.model.scope(scope) : this.model;
      const result = (await model_.findAll(options)) as unknown as T[];
      if (result.length) await this.emit('afterFind', result);
      return result;
    }
  }

  /**
   * find one instance
   * @param options sequelize.FindOptions<T>
   * @param transaction sequelize.Transaction
   * @param scope string
   * @returns T
   */
  async findOne(
    options: FindOptions<T>,
    transaction?: Transaction,
    scope?: string,
  ): Promise<T> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.findOne(options, transaction, scope),
      );
    } else {
      options.include = this.defaultInclude;
      options.transaction = transaction;
      const model_ = scope ? this.model.scope(scope) : this.model;
      const result = (await model_.findOne(options)) as T;
      if (result) await this.emit('afterFind', [result]);
      return result;
    }
  }

  /**
   * find instance by id
   * @param id whether number or string
   * @param transaction sequelize.Transaction
   * @param options sequelize.FindOptions<T>
   * @param scope string
   * @returns T
   */
  async findById(id: ID, transaction?: Transaction, scope?: string): Promise<T>;
  async findById(
    id: ID,
    transaction?: Transaction,
    options?: FindOptions<T>,
  ): Promise<T>;
  async findById(
    id: ID,
    transaction?: Transaction,
    optionsOrScope?: FindOptions<T> | string,
  ): Promise<T> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        typeof optionsOrScope === 'string'
          ? this.findById(id, transaction, optionsOrScope)
          : this.findById(id, transaction, optionsOrScope),
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
      if (!result) throw new NotFound('Entitiy Not Found');
      await this.emit('afterFind', [result]);
      return result;
    }
  }

  /**
   * update instance
   * @param instance T
   * @param transaction sequelize.Transaction
   * @returns T
   */
  async update(instance: T, transaction?: Transaction): Promise<T>;
  /**
   * update instances
   * @param instance T[]
   * @param transaction sequelize.Transaction
   * @returns T[]
   */
  async update(instances: T[], transaction?: Transaction): Promise<T[]>;
  async update(
    instances: T | T[],
    transaction?: Transaction,
  ): Promise<T | T[]> {
    if (!transaction) {
      return this.inTransaction(async (transaction) =>
        Array.isArray(instances)
          ? this.update(instances, transaction)
          : this.update(instances, transaction),
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
      }

      if (existingInst.length) {
        await this.emit('beforeSave', 'update', existingInst);
        await this.emit('beforeUpdate', existingInst);
      }
      const [created] = await Promise.all([
        this.create(newInstances, transaction),
        ...existingInst.map(
          async (i) =>
            await this.model.update(i, {
              where: { id: this.getPrimaryKey(i) } as WhereOptions<T>,
              transaction,
            }),
        ),
      ]);
      if (existingInst.length) {
        await this.emit('afterSave', 'update', existingInst);
        await this.emit('afterUpdate', existingInst);

        // update relationships
        await logSection('updateRelationships', this.logger, () =>
          this.updateRelationships(existingInst, transaction),
        );
      }

      return this.find(
        {
          where: {
            id: [...created, ...existingInst].map((i) => this.getPrimaryKey(i)),
          } as WhereOptions<T>,
        },
        transaction,
      );
    } else if (!this.getPrimaryKey(instances)) {
      return this.create(instances, transaction);
    } else {
      instances['updatedAt'] = new Date();

      await this.emit('beforeSave', 'update', [instances]);
      await this.emit('beforeUpdate', [instances]);
      await this.model.update(instances, {
        where: { id: this.getPrimaryKey(instances) } as WhereOptions<T>,
        transaction,
      });
      await this.emit('afterSave', 'update', [instances]);
      await this.emit('afterUpdate', [instances]);

      // update relationships
      await logSection('updateRelationships', this.logger, () =>
        this.updateRelationships([instances], transaction),
      );

      return this.findById(this.getPrimaryKey(instances), transaction);
    }
  }

  /**
   * delete multiple instances
   * @param instances T[]
   * @param transaction sequelize.Transaction
   * @returns T[]
   */
  async delete(instances: T[], transaction?: Transaction): Promise<T[]> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.delete(instances, transaction),
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
        transaction,
      );
      for (const instance of instances) {
        instance['deletedAt'] = new Date();
      }

      if (this.deleteMode === 'deletedAt') {
        if (instances.length) {
          await this.emit('beforeDestroy', instances);
          await Promise.all(
            instances.map(
              async (i) =>
                await this.model.update(i, {
                  where: { id: this.getPrimaryKey(i) } as WhereOptions<T>,
                  transaction,
                }),
            ),
          );
          await this.emit('afterDestroy', instances);
        }
      } else if (instances.length) {
        await this.emit('beforeDestroy', instances);
        await this.model.destroy({
          where: {
            id: targets.map((i) => this.getPrimaryKey(i)),
          } as WhereOptions<T>,
          transaction,
        });
        await this.emit('afterDestroy', instances);
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
   * @param transaction sequelize.Transaction
   * @returns T
   */
  async deleteById(id: ID, transaction?: Transaction): Promise<T> {
    if (!transaction) {
      return this.inTransaction((transaction) =>
        this.deleteById(id, transaction),
      );
    } else {
      const target = await this.findById(id, transaction);
      target['deletedAt'] = new Date();

      await this.emit('beforeDestroy', [target]);
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
      await this.emit('afterDestroy', [target]);

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
