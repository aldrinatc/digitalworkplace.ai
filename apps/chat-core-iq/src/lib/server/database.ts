import { AsyncLocalStorage } from 'node:async_hooks';
import postgres, { type Sql, type TransactionSql } from 'postgres';

const transactionContext = new AsyncLocalStorage<Sql | TransactionSql>();
let connection: Sql | undefined;
export function database(): Sql | TransactionSql {
  const transaction = transactionContext.getStore();
  if (transaction) return transaction;
  if (!connection) {
    if (!process.env.DATABASE_URL)
      throw new Error('Database connection is not configured');
    connection = postgres(process.env.DATABASE_URL, {
      max: 2,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
      connection: {
        statement_timeout: 15000,
        application_name: 'digitalworkplace-dcq',
      },
    });
  }
  return connection;
}
export async function inTransaction<T>(action: () => Promise<T>): Promise<T> {
  if (transactionContext.getStore()) return action();
  const client = database() as Sql;
  return client.begin(async (tx) =>
    transactionContext.run(tx, action),
  ) as Promise<T>;
}

export async function pruneExpiredState() {
  await database()`delete from dcq.runtime_state where (namespace,id) in (select namespace,id from dcq.runtime_state where expires_at < now() limit 100)`;
}
