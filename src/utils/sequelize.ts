import type { Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';

import { HttpStatus } from '@nestjs/common';

import { CustomHttpException } from 'src/classes/exceptions/CustomHttpException';

export async function inTransaction<T>(
  sequelize: Sequelize,
  callback: (transaction: Transaction) => Promise<T>,
  transaction?: Transaction,
): Promise<T> {
  const withTransaction = !!transaction;
  let rollback = false;
  if (!withTransaction) transaction = await sequelize.transaction();
  try {
    return await callback(transaction);
  } catch (e) {
    if (!withTransaction) {
      await transaction.rollback();
      rollback = true;
    }
    if (
      process.env.NODE_ENV === 'production' ||
      e instanceof CustomHttpException
    )
      throw e;
    const error = new CustomHttpException(e, HttpStatus.INTERNAL_SERVER_ERROR);
    error.stack = e.stack || error.stack;
    throw error;
  } finally {
    if (!withTransaction && !rollback) await transaction.commit();
  }
}
