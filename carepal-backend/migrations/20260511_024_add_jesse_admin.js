/** @param {import('knex').Knex} knex */
export async function up(knex) {
  const exists = await knex('users').where({ email: 'vandezand@bopinc.org' }).first();
  if (exists) {
    await knex('users').where({ email: 'vandezand@bopinc.org' }).update({ role: 'admin' });
  } else {
    await knex('users').insert({
      email: 'vandezand@bopinc.org',
      name: 'Jesse van de Zand',
      role: 'admin',
      city: null,
      domain: 'bopinc.org',
    });
  }
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex('users').where({ email: 'vandezand@bopinc.org' }).del();
}
