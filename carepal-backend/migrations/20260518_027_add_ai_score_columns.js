/**
 * F3 — AI resume screener. Persists the Claude-API screening result on the
 * candidate row so it's queryable, sortable, and survives a re-screen.
 *
 *   ai_score             0–100 integer. Null = not yet screened.
 *   ai_score_explanation 2–3 sentence rationale from the model. Null until set.
 *
 * Both nullable because screening is optional — a candidate can advance
 * through the pipeline without ever being scored. The route layer is the
 * only writer (PATCH /api/candidates does NOT accept these fields).
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
