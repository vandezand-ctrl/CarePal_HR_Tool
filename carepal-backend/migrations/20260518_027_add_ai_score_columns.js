/**
 * Persists AI screening result on candidate rows.
 *
 *   ai_score             0–100 integer. Null = not yet screened.
 *   ai_score_explanation 2–3 sentence rationale from the model. Null until set.
 *
 * Both nullable: screening is optional, candidates can advance without it.
 *
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.alterTable('candidates', (table) => {
    table.integer('ai_score').nullable();
    table.text('ai_score_explanation').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('candidates', (table) => {
    table.dropColumn('ai_score_explanation');
    table.dropColumn('ai_score');
  });
}
