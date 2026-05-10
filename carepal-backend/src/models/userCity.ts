import { getDb } from '../db/index.js';

export async function getCitiesForUser(userId: number): Promise<string[]> {
  const rows = await getDb()('user_cities')
    .where({ user_id: userId })
    .select('city')
    .orderBy('city');
  return rows.map((r: { city: string }) => r.city);
}

export async function getCitiesForUsers(
  userIds: number[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (userIds.length === 0) return map;
  const rows = await getDb()('user_cities')
    .whereIn('user_id', userIds)
    .select('user_id', 'city')
    .orderBy('city');
  for (const r of rows as Array<{ user_id: number; city: string }>) {
    const list = map.get(r.user_id) ?? [];
    list.push(r.city);
    map.set(r.user_id, list);
  }
  return map;
}

export async function setUserCities(
  userId: number,
  cities: string[],
  assignedBy: number,
): Promise<void> {
  const dedup = Array.from(new Set(cities));
  await getDb().transaction(async (trx) => {
    await trx('user_cities').where({ user_id: userId }).del();
    if (dedup.length > 0) {
      await trx('user_cities').insert(
        dedup.map((city) => ({
          user_id: userId,
          city,
          assigned_by: assignedBy,
        })),
      );
    }
  });
}

export async function listAllCities(): Promise<string[]> {
  const rows = await getDb().raw(`
    SELECT DISTINCT city FROM (
      SELECT city FROM headcount WHERE city IS NOT NULL
      UNION
      SELECT city FROM requisitions WHERE city IS NOT NULL
    ) AS all_cities
    ORDER BY city
  `);
  // knex.raw returns [rows, fields] for MySQL, plain rows array for SQLite.
  const result = Array.isArray(rows[0]) ? rows[0] : rows;
  return result.map((r: { city: string }) => r.city);
}
