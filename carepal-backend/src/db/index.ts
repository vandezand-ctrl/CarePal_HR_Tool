import knex, { Knex } from 'knex';

let instance: Knex | undefined;

export function getDb(): Knex {
  if (!instance) {
    instance = knex({
      client: 'better-sqlite3',
      connection: { filename: './data/carepal.sqlite' },
      useNullAsDefault: true,
    });
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = undefined;
  }
}
