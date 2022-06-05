import { Logger } from '@nestjs/common';
import deepmerge = require('deepmerge');
import EventEmitter = require('events');
import { FindOptions, Transaction, WhereOptions } from 'sequelize';
import { Model, Sequelize } from 'sequelize-typescript';

import { logSection } from 'src/utils';
import { inTransaction } from 'src/utils/sequelize';

export class BaseDtoService<T extends Model, ID = number> extends EventEmitter {
  constructor(
    protected readonly sequelize: Sequelize,
    protected readonly model: { new(): T } & typeof Model, // eslint-disable-line prettier/prettier
    protected readonly deleteMode: 'deletedAt' | 'destroy' = 'destroy',
    protected readonly logger?: Logger,
  ) {
    super();
    this.logger = new Logger(this.constructor.name);
    this.on('beforeCreate', (i) =>
      this.logger.debug(`[create] ${this.toString(i)}`),
    );
    this.on('beforeUpdate', (i) =>
      this.logger.debug(`[update] ${this.toString(i)}`),
    );
    this.on('beforeDestroy', (i) =>
      this.logger.debug(`[destroy] ${this.toString(i)}`),
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  /* eslint-disable @typescript-eslint/no-empty-function */
  /**
   * create relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   *
   */
  protected async createRelationships(
    instances: T[],
    transaction: Transaction,
  ) {}

  /**
   * update relationships
   * @param instances T[]
   * @param transaction sequelize.Transaction
   *
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
    callback: (type: 'create' | 'update', instance: T) => void,
  );
  public on(
    event: 'afterSave',
    callback: (type: 'create' | 'update', instance: T, created?: T) => void,
  );
  public on(event: 'beforeCreate', callback: (instance: T) => void);
  public on(event: 'afterCreate', callback: (instance: T, created?: T) => void);
  public on(event: 'beforeUpdate', callback: (instance: T) => void);
  public on(event: 'afterUpdate', callback: (instance: T) => void);
  public on(event: 'beforeDestroy', callback: (instance: T) => void);
  public on(event: 'afterDestroy', callback: (instance: T) => void);
  public on(event: string, callback: (...args: any[]) => void) {
    super.on(event, callback);
    return this;
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
      return inTransaction(this.sequelize, async (transaction) =>
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
      for (const instance of instances) {
        this.emit('beforeSave', 'create', instance);
        this.emit('beforeCreate', instance);
      }
      const result = (await this.model.bulkCreate(instances, {
        transaction,
      })) as unknown as T[];
      for (let i = 0, length = instances.length; i < length; i += 1) {
        Object.assign(result[i], instances[i]);
      }
      for (let i = 0, length = instances.length; i < length; i += 1) {
        const instance = instances[i];
        const created = result[i];
        this.emit('afterSave', 'create', instance, created);
        this.emit('afterCreate', instance, created);
      }

      // create relationships
      await logSection(this.logger, 'createRelationships', () => {
        return this.createRelationships(result, transaction);
      });

      // find
      if (isSingle) {
        return options
          ? this.findById(result[0].id, transaction, options)
          : result[0];
      } else if (options) {
        return this.find(
          {
            where: { id: result.map((i) => i.id) } as WhereOptions<T>,
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
      return inTransaction(this.sequelize, (transaction) =>
        this.find(options, transaction, scope),
      );
    } else {
      options.transaction = transaction;
      const model_ = scope ? this.model.scope(scope) : this.model;
      return (await model_.findAll(options)) as unknown as T[];
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
      return inTransaction(this.sequelize, (transaction) =>
        this.findOne(options, transaction, scope),
      );
    } else {
      options.transaction = transaction;
      const model_ = scope ? this.model.scope(scope) : this.model;
      return (await model_.findOne(options)) as T;
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
      return inTransaction(this.sequelize, (transaction) =>
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
      options.transaction = options.transaction || transaction;
      return (await model_.findOne(options)) as T;
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
      return inTransaction(this.sequelize, async (transaction) =>
        Array.isArray(instances)
          ? this.update(instances, transaction)
          : this.update(instances, transaction),
      );
    } else if (Array.isArray(instances)) {
      // skip if empty
      if (!instances.length) return [];

      // create or update (note no delete)
      const newInstances = instances.filter((i) => !i.id);
      const existingInst = instances.filter((i) => i.id);

      // assign updatedAt
      for (const instance of existingInst) {
        instance['updatedAt'] = new Date();
      }

      await Promise.all([
        this.create(newInstances, transaction),
        ...existingInst.map((i) => {
          this.emit('beforeSave', 'update', i);
          this.emit('beforeUpdate', i);
          const result = this.model.update(i, {
            where: { id: i.id } as WhereOptions<T>,
            transaction,
          });
          this.emit('afterSave', 'update', i);
          this.emit('afterUpdate', i);
          return result;
        }),
      ]);

      // update relationships
      await logSection(this.logger, 'updateRelationships', () =>
        this.updateRelationships(existingInst, transaction),
      );

      return this.find(
        { where: { id: existingInst.map((i) => i.id) } as WhereOptions<T> },
        transaction,
      );
    } else if (!instances.id) {
      return this.create(instances, transaction);
    } else {
      instances['updatedAt'] = new Date();

      this.emit('beforeSave', 'update', instances);
      this.emit('beforeUpdate', instances);
      await this.model.update(instances, {
        where: { id: instances.id } as WhereOptions<T>,
        transaction,
      });
      this.emit('afterSave', 'update', instances);
      this.emit('afterUpdate', instances);

      // update relationships
      await logSection(this.logger, 'updateRelationships', () =>
        this.updateRelationships([instances], transaction),
      );

      return this.findById(instances.id, transaction);
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
      return inTransaction(this.sequelize, (transaction) =>
        this.delete(instances, transaction),
      );
    } else if (!instances.length) {
      return [];
    } else {
      const targets = await this.find(
        {
          where: {
            id: instances.map((i) => i.id).filter((id) => id),
          } as WhereOptions<T>,
        },
        transaction,
      );
      for (const instance of instances) {
        instance['deletedAt'] = new Date();
      }

      if (this.deleteMode === 'deletedAt') {
        await Promise.all(
          instances.map((i) => {
            this.emit('beforeDestroy', i);
            const result = this.model.update(i, {
              where: { id: i.id } as WhereOptions<T>,
              transaction,
            });
            this.emit('afterDestroy', i);
            return result;
          }),
        );
      } else {
        for (const instance of instances) {
          this.emit('beforeDestroy', instance);
        }
        await this.model.destroy({
          where: { id: targets.map((i) => i.id) } as WhereOptions<T>,
          transaction,
        });
        for (const instance of instances) {
          this.emit('afterDestroy', instance);
        }
      }

      // delete relationships
      await logSection(this.logger, 'deleteRelationships', () =>
        this.deleteRelationships(instances, transaction),
      );

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
      return inTransaction(this.sequelize, (transaction) =>
        this.deleteById(id, transaction),
      );
    } else {
      const target = await this.findById(id, transaction);
      target['deletedAt'] = new Date();

      this.emit('beforeDestroy', target);
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
      this.emit('afterDestroy', target);

      // delete relationships
      await logSection(this.logger, 'deleteRelationships', () =>
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
