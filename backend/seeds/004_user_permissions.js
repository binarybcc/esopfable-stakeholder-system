/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('user_permissions').del();
  
  // Insert seed entries
  await knex('user_permissions').insert([
    // Admin permissions - full access
    {
      id: '880e8400-e29b-41d4-a716-446655440001',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      permission_type: 'admin_full_access',
      resource_id: null, // Global permission
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    
    // Legal team permissions
    {
      id: '880e8400-e29b-41d4-a716-446655440002',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      permission_type: 'documents_read_confidential',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440003',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      permission_type: 'stakeholders_manage',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440004',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      permission_type: 'evidence_manage',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440005',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      permission_type: 'pr_messages_approve',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    
    // Government entity permissions
    {
      id: '880e8400-e29b-41d4-a716-446655440006',
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      permission_type: 'documents_read_internal',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440007',
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      permission_type: 'evidence_read',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440008',
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      permission_type: 'communications_read',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    
    // Witness permissions (limited access)
    {
      id: '880e8400-e29b-41d4-a716-446655440009',
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      permission_type: 'documents_read_public',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440010',
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      permission_type: 'communications_create',
      resource_id: '660e8400-e29b-41d4-a716-446655440006', // Own stakeholder record
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440011',
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      permission_type: 'profile_update',
      resource_id: '660e8400-e29b-41d4-a716-446655440006',
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    
    // Media contact permissions (very limited)
    {
      id: '880e8400-e29b-41d4-a716-446655440012',
      user_id: '550e8400-e29b-41d4-a716-446655440005',
      permission_type: 'documents_read_public',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440013',
      user_id: '550e8400-e29b-41d4-a716-446655440005',
      permission_type: 'pr_messages_read_published',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    {
      id: '880e8400-e29b-41d4-a716-446655440014',
      user_id: '550e8400-e29b-41d4-a716-446655440005',
      permission_type: 'communications_create',
      resource_id: '660e8400-e29b-41d4-a716-446655440007', // Own stakeholder record
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001'
    },
    
    // Time-limited permissions examples
    {
      id: '880e8400-e29b-41d4-a716-446655440015',
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      permission_type: 'documents_read_secret',
      resource_id: null,
      granted_at: knex.fn.now(),
      granted_by: '550e8400-e29b-41d4-a716-446655440001',
      expires_at: knex.raw("CURRENT_TIMESTAMP + INTERVAL '90 days'") // Expires in 90 days
    }
  ]);
};