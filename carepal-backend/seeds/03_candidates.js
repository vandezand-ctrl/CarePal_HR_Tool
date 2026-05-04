/**
 * Seed candidates and their TA assignments.
 *
 * PR-L: assignments are now in the `candidate_assignments` table; the legacy
 * `ta` string column on `candidates` was dropped in migration 015. We seed
 * candidates first, then look up the assignee user by name and insert an
 * assignment row per candidate.
 *
 * The order of seed files matters: `02_users.js` runs before this file (file
 * order is alphabetical), so the named users below already exist.
 */
/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex('candidate_assignments').del();
  await knex('candidates').del();

  // (id, name, phone, ..., assigneeName) — we use assigneeName to resolve
  // the user id for the assignment below.
  const candidates = [
    { id:'C-001', req_id:'REQ-002', name:'Sakthivel A',     phone:'9790454372', email:null,                              city:'Chennai',   current_role:'City Head',         company:'Fibe',          current_ctc:null,  expected_ctc:null,  notice:'Immediate', sourced_at:'2025-12-01', stage:'R2 Complete',   offer_date:null,        join_date:null,         bu:'CPM',  assigneeName:'Payal'   },
    { id:'C-002', req_id:'REQ-002', name:'Ravikumar K M',   phone:'6361106732', email:'ravikumarkm6918@gmail.com',       city:'Bangalore', current_role:'Operation Manager', company:'Even Healthcare', current_ctc:75000, expected_ctc:93000, notice:'7 Days',    sourced_at:'2025-11-05', stage:'Joined',        offer_date:'2025-11-14', join_date:'2025-11-17', bu:'IGIV', assigneeName:'Shubham' },
    { id:'C-003', req_id:'REQ-001', name:'Priya Sharma',    phone:'9845012345', email:'priya.sharma@gmail.com',           city:'Bangalore', current_role:'BDA',               company:'Pristyn Care',  current_ctc:32000, expected_ctc:40000, notice:'30 Days',   sourced_at:'2026-03-28', stage:'R1 Scheduled',  offer_date:null,        join_date:null,         bu:'CPM',  assigneeName:'Namita'  },
    { id:'C-004', req_id:'REQ-001', name:'Rahul Menon',     phone:'8867234561', email:'rahul.menon@gmail.com',            city:'Bangalore', current_role:'Sales Executive',   company:'Bajaj Finserv', current_ctc:28000, expected_ctc:35000, notice:'15 Days',   sourced_at:'2026-03-29', stage:'Sourced',       offer_date:null,        join_date:null,         bu:'CPM',  assigneeName:'Namita'  },
    { id:'C-005', req_id:'REQ-005', name:'Lalith Singh',    phone:'8121632868', email:'rlalithkumarsingh@gmail.com',      city:'Hyderabad', current_role:'Territory Manager', company:'Oscar Healthcare', current_ctc:30000, expected_ctc:35000, notice:'7 Days',    sourced_at:'2025-10-25', stage:'R1 Scheduled',  offer_date:null,        join_date:null,         bu:'IGIV', assigneeName:'Aasiya'  },
    { id:'C-006', req_id:'REQ-003', name:'Vishal Kurali',   phone:'9823456701', email:null,                              city:'Delhi',     current_role:'BDA',               company:'Red.Health',    current_ctc:25000, expected_ctc:32000, notice:'Immediate', sourced_at:'2026-03-30', stage:'Sourced',       offer_date:null,        join_date:null,         bu:'IGIV', assigneeName:'Riddhi'  },
    { id:'C-007', req_id:'REQ-007', name:'Arjun Mullick',   phone:'9876543210', email:'arjun.mullick@gmail.com',          city:'Kolkata',   current_role:'Sales Manager',     company:'Ketto',         current_ctc:45000, expected_ctc:55000, notice:'30 Days',   sourced_at:'2026-03-22', stage:'Offered',       offer_date:'2026-04-01', join_date:null,         bu:'IGIV', assigneeName:'Vedika'  },
    { id:'C-008', req_id:'REQ-005', name:'Tarkeshhwar R',   phone:'8309300285', email:null,                              city:'Hyderabad', current_role:'BDA',               company:'Byjus',         current_ctc:null,  expected_ctc:null,  notice:null,        sourced_at:'2025-08-16', stage:'R2 Scheduled',  offer_date:null,        join_date:null,         bu:'IGIV', assigneeName:'Namita'  },
    { id:'C-009', req_id:'REQ-008', name:'Simran Gaur',     phone:'8920989190', email:'simrangaur6999@gmail.com',         city:'Delhi',     current_role:'Sr BDA',            company:'Batra Hospital', current_ctc:32000, expected_ctc:40000, notice:'15 Days',   sourced_at:'2026-04-02', stage:'Sourced',       offer_date:null,        join_date:null,         bu:'CPM',  assigneeName:'Namita'  },
  ];

  await knex('candidates').insert(
    candidates.map(({ assigneeName: _ignored, ...row }) => row),
  );

  // Resolve assignee names -> user ids and insert one assignment row per candidate.
  const users = await knex('users').select('id', 'name');
  const userIdByName = new Map(users.map((u) => [u.name, u.id]));
  const assignments = [];
  for (const c of candidates) {
    const userId = userIdByName.get(c.assigneeName);
    if (!userId) {
      throw new Error(`seed 03_candidates: no user with name "${c.assigneeName}" — fix seeds/02_users.js or this file.`);
    }
    assignments.push({ candidate_id: c.id, user_id: userId, assigned_by: null });
  }
  await knex('candidate_assignments').insert(assignments);
}
