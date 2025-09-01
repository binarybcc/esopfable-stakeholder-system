/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('stakeholders').del();
  
  // Insert seed entries
  await knex('stakeholders').insert([
    // Legal Team
    {
      id: '660e8400-e29b-41d4-a716-446655440001',
      user_id: '550e8400-e29b-41d4-a716-446655440002',
      category: 'legal_team',
      subcategory: 'erisa_specialists',
      name: 'Sarah Mitchell',
      organization: 'Mitchell & Associates',
      title: 'Senior ERISA Attorney',
      contact_info: {
        phone: '+1-555-0101',
        email: 'sarah.mitchell@lawfirm.com',
        address: '123 Legal Plaza, Washington DC 20001'
      },
      metadata: {
        specialty: 'ERISA Fiduciary Breaches',
        engagement_status: 'lead_counsel',
        fee_structure: 'contingency_33_percent'
      },
      security_level: 'standard',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440002',
      category: 'legal_team',
      subcategory: 'fca_attorneys',
      name: 'Michael Rodriguez',
      organization: 'Rodriguez Law Group',
      title: 'False Claims Act Specialist',
      contact_info: {
        phone: '+1-555-0102',
        email: 'mrodriguez@fraudlaw.com',
        address: '456 Justice Ave, New York NY 10001'
      },
      metadata: {
        specialty: 'False Claims Act',
        engagement_status: 'co_counsel',
        fee_structure: 'hourly_650'
      },
      security_level: 'standard',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    
    // Government Entities
    {
      id: '660e8400-e29b-41d4-a716-446655440003',
      user_id: '550e8400-e29b-41d4-a716-446655440003',
      category: 'government_entities',
      subcategory: 'primary_targets',
      name: 'Department of Labor - EBSA',
      organization: 'U.S. Department of Labor',
      title: 'Employee Benefits Security Administration',
      contact_info: {
        phone: '+1-202-693-8300',
        email: 'ebsa.enforcement@dol.gov',
        address: '200 Constitution Ave NW, Washington DC 20210'
      },
      metadata: {
        jurisdiction: 'federal',
        contact_person: 'Agent Jennifer Chen',
        damage_estimate: 25000000,
        cooperation_level: 'high',
        legal_counsel: 'DOJ Civil Division'
      },
      security_level: 'restricted',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '660e8400-e29b-41d4-a716-446655440004',
      category: 'government_entities', 
      subcategory: 'coalition_members',
      name: 'SEC Enforcement Division',
      organization: 'Securities and Exchange Commission',
      title: 'Enforcement Division',
      contact_info: {
        phone: '+1-202-551-4500',
        email: 'enforcement@sec.gov',
        address: '100 F Street NE, Washington DC 20549'
      },
      metadata: {
        jurisdiction: 'federal',
        contact_person: 'Director Mark Thompson',
        damage_estimate: 15000000,
        cooperation_level: 'medium',
        legal_counsel: 'SEC Office of General Counsel'
      },
      security_level: 'restricted',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    
    // ESOP Participants
    {
      id: '660e8400-e29b-41d4-a716-446655440005',
      category: 'esop_participants',
      name: 'Mary Johnson',
      organization: 'Target Company Inc.',
      title: 'Senior Engineer',
      contact_info: {
        phone: '+1-555-0201',
        email: 'mary.j.secure@protonmail.com',
        address: 'Withheld for security'
      },
      metadata: {
        years_service: 15,
        esop_stake: 45000,
        sentiment: 'supportive',
        leadership_role: 'union_rep'
      },
      security_level: 'high',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    
    // Key Witnesses  
    {
      id: '660e8400-e29b-41d4-a716-446655440006',
      user_id: '550e8400-e29b-41d4-a716-446655440004',
      category: 'key_witnesses',
      subcategory: 'primary_witnesses',
      name: 'David Kim',
      organization: 'Target Company Inc.',
      title: 'Former CFO',
      contact_info: {
        phone: '+1-555-0301',
        email: 'dkim.secure@protonmail.com',
        address: 'Protected location'
      },
      metadata: {
        evidence_access: 'financial_records',
        vulnerability_level: 'high',
        protection_needed: 'witness_protection',
        testimony_strength: 9
      },
      security_level: 'high',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    
    // Media Contacts
    {
      id: '660e8400-e29b-41d4-a716-446655440007',
      user_id: '550e8400-e29b-41d4-a716-446655440005',
      category: 'media_contacts',
      subcategory: 'investigative',
      name: 'Lisa Chen',
      organization: 'Washington Post',
      title: 'Investigative Reporter',
      contact_info: {
        phone: '+1-555-0401',
        email: 'lisa.chen@washpost.com',
        address: 'Washington Post Newsroom'
      },
      metadata: {
        beat: 'corporate_fraud',
        relationship_quality: 'excellent',
        reach: 'national',
        editorial_stance: 'neutral'
      },
      security_level: 'standard',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    
    // Opposition
    {
      id: '660e8400-e29b-41d4-a716-446655440008',
      category: 'opposition',
      subcategory: 'jerry_allies',
      name: 'Jerry Patterson',
      organization: 'Target Company Inc.',
      title: 'CEO',
      contact_info: {
        phone: '+1-555-0501',
        email: 'jpatterson@targetcompany.com',
        address: 'Corporate Headquarters'
      },
      metadata: {
        influence_level: 'high',
        likely_response: 'aggressive_legal_defense',
        mitigation_strategy: 'document_preservation_order'
      },
      security_level: 'standard',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};