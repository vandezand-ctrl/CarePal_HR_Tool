/**
 * Add anticipated closure date to requisitions (PR-D / R3 in Apr 29 backlog).
 * Sahil + Akhlaque want a "when can this req close?" view — admins set this
 * manually based on the linked candidate's interview / offer state.
 *
 * Nullable because legacy reqs created before this migration have no value.
 *
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.alterTable('requisitions', (table) => {
    table.date('closure_date').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('requisitions', (table) => {
    table.dropColumn('closure_date');
  });
}
