/** @type {import('knex').Knex.Config} */
export default {
  client: 'better-sqlite3',
  connection: {
    filename: './data/carepal.sqlite',
  },
  useNullAsDefault: true,
  migrations: {
    directory: './migrations',
    extension: 'js',
  },
  seeds: {
    directory: './seeds',
    extension: 'js',
  },
};
