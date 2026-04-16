import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import knex, { Knex } from 'knex';

/**
 * Environment-aware DB singleton.
 * - DATABASE_URL set (prod): MySQL via mysql2
 * - Otherwise (dev): SQLite file at ./data/carepal.sqlite
 *
 * Kept in one place so the Cloud Run / local split is a single toggle.
 */
let instance: Knex | undefined;

export function getDb(): Knex {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    instance = url
      ? knex({
          client: 'mysql2',
          connection: url,
          pool: { min: 0, max: 5 },
        })
      : knex({
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

/**
 * Run migrations programmatically. Called at server startup in production so
 * a fresh Cloud SQL DB is ready-to-serve without a separate migration step.
 * Resolves the migrations dir relative to the compiled file location so it
 * works regardless of the process's working directory.
 */
export async function runMigrations(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // In dev: src/db/ → ../migrations = src/../migrations = carepal-backend/migrations
  // In prod (dist/db/): → ../migrations = dist/../migrations = carepal-backend/migrations
  const candidates = [
    path.resolve(here, '..', '..', 'migrations'), // typical
    path.resolve(here, '..', 'migrations'),       // fallback
  ];
  const migrationsDir = candidates.find((p) => fs.existsSync(p));
  if (!migrationsDir) throw new Error(`migrations directory not found (tried ${candidates.join(', ')})`);
  const db = getDb();
  await db.migrate.latest({ directory: migrationsDir, extension: 'js' });
}
