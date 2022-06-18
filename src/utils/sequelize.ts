import type { Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';

import { CustomException } from 'src/classes/exceptions/CustomException';

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
    CustomException.throw('inTransaction', e);
  } finally {
    if (!withTransaction && !rollback) await transaction.commit();
  }
}
