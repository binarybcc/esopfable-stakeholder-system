/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('users').del();
  
  // Insert seed entries
  await knex('users').insert([
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      auth0_id: 'auth0|admin001',
      email: 'admin@casemanagement.com',
      role_type: 'legal_team',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002', 
      auth0_id: 'auth0|legal001',
      email: 'lead.attorney@lawfirm.com',
      role_type: 'legal_team',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      auth0_id: 'auth0|gov001', 
      email: 'investigator@dol.gov',
      role_type: 'government_entity',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      auth0_id: 'auth0|witness001',
      email: 'key.witness@company.com',
      role_type: 'witness',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      auth0_id: 'auth0|media001',
      email: 'reporter@investigativenews.com',
      role_type: 'media_contact',
      is_active: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};