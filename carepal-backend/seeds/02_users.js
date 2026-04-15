/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex('users').del();
  await knex('users').insert([
    // Admin
    { email: 'sahil@carepalmoney.com', name: 'Sahil', role: 'admin', city: null, domain: 'carepalmoney.com' },

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

    // TA team — Akhlaque's recruiters
    { email: 'akhlaque@carepalmoney.com', name: 'Akhlaque', role: 'ta', city: null, domain: 'carepalmoney.com' },
    { email: 'payal@carepalmoney.com', name: 'Payal', role: 'ta', city: 'Chennai', domain: 'carepalmoney.com' },
    { email: 'shubham@carepalmoney.com', name: 'Shubham', role: 'ta', city: 'Bangalore', domain: 'carepalmoney.com' },
    { email: 'namita@carepalmoney.com', name: 'Namita', role: 'ta', city: 'Bangalore', domain: 'carepalmoney.com' },
    { email: 'aasiya@impactguru.com', name: 'Aasiya', role: 'ta', city: 'Hyderabad', domain: 'impactguru.com' },
    { email: 'riddhi@impactguru.com', name: 'Riddhi', role: 'ta', city: 'Delhi', domain: 'impactguru.com' },
    { email: 'vedika@impactguru.com', name: 'Vedika', role: 'ta', city: 'Kolkata', domain: 'impactguru.com' },
  ]);
}
