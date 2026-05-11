/**
 * PR-Q: add raised_by_user_id FK to requisitions.
 *
 * The existing raised_by column is a free-text name string. This FK lets
 * us reliably check ownership ("can this user change approvers on their own req?").
 * Backfills by matching raised_by to users.name. Unmatched rows get NULL.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('requisitions', (table) => {
    table
      .integer('raised_by_user_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('users');
  });

  // Backfill: match raised_by (name) to users.name.
  const reqs = await knex('requisitions').select('id', 'raised_by');
  for (const req of reqs) {
    if (!req.raised_by) continue;
    const user = await knex('users')
      .whereRaw('LOWER(name) = LOWER(?)', [req.raised_by])
      .first();
    if (user) {
      await knex('requisitions')
        .where('id', req.id)
        .update({ raised_by_user_id: user.id });
    }
  }
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('requisitions', (table) => {
    table.dropColumn('raised_by_user_id');
  });
}
