/**
 * AOP (Annual Operating Plan) targets per city + business unit.
 * Only the target is stored here — actuals (active, offered) are derived from
 * the candidates pipeline at query time.
 *
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('headcount').del();
  await knex('headcount').insert([
    { city: 'Bangalore', bu: 'CPM',  aop: 7 },
    { city: 'Bangalore', bu: 'IGIV', aop: 5 },
    { city: 'Chennai',   bu: 'CPM',  aop: 3 },
    { city: 'Chennai',   bu: 'IGIV', aop: 3 },
    { city: 'Delhi',     bu: 'CPM',  aop: 5 },
    { city: 'Delhi',     bu: 'IGIV', aop: 7 },
    { city: 'Mumbai',    bu: 'CPM',  aop: 5 },
    { city: 'Mumbai',    bu: 'IGIV', aop: 7 },
    { city: 'Hyderabad', bu: 'CPM',  aop: 5 },
    { city: 'Hyderabad', bu: 'IGIV', aop: 5 },
    { city: 'Pune',      bu: 'CPM',  aop: 5 },
    { city: 'Kolkata',   bu: 'IGIV', aop: 4 },
    { city: 'Ahmedabad', bu: 'CPM',  aop: 2 },
    { city: 'Indore',    bu: 'IGIV', aop: 3 },
  ]);
}
