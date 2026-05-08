// PR-O: when an admin opens the Dashboard, we show a toast listing AOP target
// changes by *other* admins since this timestamp. "Got it" bumps it. Mirrors
// the last_inbox_seen_at column added in PR-K (migration 013).
//
// Nullable so existing users default to "no unseen" — the join in
// getUnseenAopChanges treats null as a no-match and we deliberately don't
// surprise existing admins with a backlog notification on first sign-in.

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.datetime('last_aop_seen_at').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_aop_seen_at');
  });
}
