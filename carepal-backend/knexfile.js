// Environment-aware knex config.
// - Local dev: SQLite file (no DATABASE_URL set).
// - Production: MySQL via DATABASE_URL (e.g. mysql://user:pass@host:port/db).
//   Cloud Run + Cloud SQL: use the MySQL URL pointing at the proxy socket OR
//   a private IP inside a VPC connector.

import fs from 'node:fs';

const url = process.env.DATABASE_URL;

// Ensure ./data/ exists before SQLite tries to open the file. Fresh CI runners
// and clean checkouts don't have it; better-sqlite3 throws "Cannot open
// database because the directory does not exist" instead of creating it.
if (!url) fs.mkdirSync('./data', { recursive: true });

/** @type {import('knex').Knex.Config} */
const config = url
  ? {
      client: 'mysql2',
      connection: url,
      pool: { min: 0, max: 5 },
      migrations: { directory: './migrations', extension: 'js' },
      seeds: { directory: './seeds', extension: 'js' },
    }
  : {
      client: 'better-sqlite3',
      connection: { filename: './data/carepal.sqlite' },
      useNullAsDefault: true,
      migrations: { directory: './migrations', extension: 'js' },
      seeds: { directory: './seeds', extension: 'js' },
    };

export default config;
