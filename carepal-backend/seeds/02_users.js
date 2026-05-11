/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex('users').del();
  await knex('users').insert([
    // Admin
    { email: 'vandezand@bopinc.org', name: 'Jesse van de Zand', role: 'admin', city: null, domain: 'bopinc.org' },
    { email: 'sahil@carepalmoney.com', name: 'Sahil Lakshmanan', role: 'admin', city: null, domain: 'carepalmoney.com' },
    // Akhlaque is the TA team lead but needs admin visibility across all recruiters' work.
    // Promoted to admin during PR-J planning (prod DB updated separately via Cloud SQL).
    { email: 'akhlaque@carepalmoney.com', name: 'Akhlaque', role: 'admin', city: null, domain: 'carepalmoney.com' },

    // Approvers — Regional Heads
    { email: 'soundappan@carepalmoney.com', name: 'Soundappan Gopal', role: 'approver', city: null, domain: 'carepalmoney.com' },
    { email: 'ankita@impactguru.com', name: 'Ankita Kumari', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'bhavesh@impactguru.com', name: 'Bhavesh N', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'mahesh@impactguru.com', name: 'Mahesh Anand', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'varun@carepalmoney.com', name: 'Varun Vishwanath', role: 'approver', city: null, domain: 'carepalmoney.com' },
    { email: 'gourav@carepalmoney.com', name: 'Gourav Singh', role: 'approver', city: 'Delhi', domain: 'carepalmoney.com' },

    // Approvers — City Leads (can also raise requisitions + interview R1)
    { email: 'himanshu@carepalmoney.com', name: 'Himanshu Jaiswal', role: 'approver', city: 'Bangalore', domain: 'carepalmoney.com' },
    { email: 'khazim@impactguru.com', name: 'Khazim Syed', role: 'approver', city: 'Hyderabad', domain: 'impactguru.com' },
    { email: 'lazer@carepalmoney.com', name: 'Lazer Rajan', role: 'approver', city: 'Chennai', domain: 'carepalmoney.com' },
    { email: 'gaurav.sharma@carepalmoney.com', name: 'Gaurav Sharma', role: 'approver', city: 'Bangalore', domain: 'carepalmoney.com' },

    // BU req-approvers — CPM
    { email: 'rashi.kharari@impactguru.com', name: 'Rashi Kharari', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'ashutosh.sharma@impactguru.com', name: 'Ashutosh Sharma', role: 'approver', city: null, domain: 'impactguru.com' },
    // BU req-approvers — IGIV
    { email: 'neer.samtani@impactguru.com', name: 'Neernidhi Samtani', role: 'approver', city: null, domain: 'impactguru.com' },
    { email: 'harish.goud@impactguru.com', name: 'Harish Goud', role: 'approver', city: null, domain: 'impactguru.com' },

    // TA team — Akhlaque's recruiters (Akhlaque himself is admin, see top of list)
    // Local-dev test account for verifying the TA view end-to-end (PR-J).
    // Owns no seed candidates so "Mine only" returns an empty list — toggle
    // "Show all" to see everyone's pipeline.
    { email: 'ta@impactguru.com', name: 'TA Test', role: 'ta', city: null, domain: 'impactguru.com' },
    { email: 'payal@carepalmoney.com', name: 'Payal', role: 'ta', city: 'Chennai', domain: 'carepalmoney.com' },
    { email: 'shubham@carepalmoney.com', name: 'Shubham', role: 'ta', city: 'Bangalore', domain: 'carepalmoney.com' },
    { email: 'namita@carepalmoney.com', name: 'Namita', role: 'ta', city: 'Bangalore', domain: 'carepalmoney.com' },
    { email: 'aasiya@impactguru.com', name: 'Aasiya', role: 'ta', city: 'Hyderabad', domain: 'impactguru.com' },
    { email: 'riddhi@impactguru.com', name: 'Riddhi', role: 'ta', city: 'Delhi', domain: 'impactguru.com' },
    { email: 'vedika@impactguru.com', name: 'Vedika', role: 'ta', city: 'Kolkata', domain: 'impactguru.com' },
  ]);
}
