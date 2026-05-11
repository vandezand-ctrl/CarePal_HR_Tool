/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex('requisitions').del();
  await knex('requisitions').insert([
    { id: 'REQ-001', city: 'Bangalore', hospital: 'Sakra & Kauvery', area: 'Marathahalli & Whitefield', bd_type: 'Floater', bu: 'CPM', hire_type: 'Replacement', replacement_for: 'Poojashree', raised_by: 'Soundappan Gopal', date: '2026-03-26', status: 'Approved', notes: 'Lending background required' },
    { id: 'REQ-002', city: 'Chennai', hospital: 'Apollo Greams Road', area: 'Greams Road', bd_type: 'Focus', bu: 'CPM', hire_type: 'Replacement', replacement_for: 'Abdul Aziz', raised_by: 'Soundappan Gopal', date: '2026-03-26', status: 'Active', notes: 'Lending exp, Hindi & Tamil speaking' },
    { id: 'REQ-003', city: 'Delhi', hospital: 'Amrita Fortis & Marengo Faridabad', area: 'Faridabad', bd_type: 'Floater', bu: 'IGIV', hire_type: 'Replacement', replacement_for: 'Sonu Kumar', raised_by: 'Mahesh Anand', date: '2026-03-26', status: 'Phase 1', notes: null },
    { id: 'REQ-004', city: 'Mumbai', hospital: 'Kokilaben Dhirubhai Ambani', area: 'Andheri West', bd_type: 'Focus', bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Varun Vishwanath', date: '2026-03-28', status: 'Phase 1', notes: 'Female candidate preferred' },
    { id: 'REQ-005', city: 'Hyderabad', hospital: 'Yashoda Hospitals', area: 'Secunderabad', bd_type: 'Focus', bu: 'IGIV', hire_type: 'Replacement', replacement_for: 'Ravi Kumar', raised_by: 'Khazim Syed', date: '2026-03-25', status: 'Active', notes: null },
    { id: 'REQ-006', city: 'Pune', hospital: 'Ruby Hall Clinic', area: 'Camp', bd_type: 'Floater', bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Varun Vishwanath', date: '2026-03-20', status: 'Filled', notes: null },
    { id: 'REQ-007', city: 'Kolkata', hospital: 'AMRI Hospitals', area: 'Salt Lake', bd_type: 'Focus', bu: 'IGIV', hire_type: 'Replacement', replacement_for: 'Ranit Mullick', raised_by: 'Mahesh Anand', date: '2026-03-15', status: 'Active', notes: null },
    { id: 'REQ-008', city: 'Delhi', hospital: 'Max Smart Super Specialty', area: 'Saket', bd_type: 'Focus', bu: 'CPM', hire_type: 'New', replacement_for: null, raised_by: 'Gourav Singh', date: '2026-04-01', status: 'Phase 1', notes: null },
  ]);
}
