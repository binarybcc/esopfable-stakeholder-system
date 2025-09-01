/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex.raw('TRUNCATE TABLE tasks, communications, pr_messages, risk_assessments CASCADE');
  
  // Insert sample tasks
  await knex('tasks').insert([
    {
      id: '990e8400-e29b-41d4-a716-446655440001',
      title: 'File ERISA Complaint',
      description: 'Prepare and file initial ERISA fiduciary breach complaint in federal court',
      status: 'in_progress',
      priority: 'critical',
      category: 'legal',
      assigned_to: '550e8400-e29b-41d4-a716-446655440002',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      stakeholder_id: '660e8400-e29b-41d4-a716-446655440001',
      due_date: knex.raw("CURRENT_TIMESTAMP + INTERVAL '7 days'"),
      started_at: knex.fn.now(),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440002',
      title: 'Witness Interview - Former CFO',
      description: 'Conduct comprehensive interview with former CFO David Kim',
      status: 'pending',
      priority: 'high',
      category: 'investigation',
      assigned_to: '550e8400-e29b-41d4-a716-446655440002',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      stakeholder_id: '660e8400-e29b-41d4-a716-446655440006',
      dependencies: ['990e8400-e29b-41d4-a716-446655440003'],
      due_date: knex.raw("CURRENT_TIMESTAMP + INTERVAL '14 days'"),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '990e8400-e29b-41d4-a716-446655440003',
      title: 'Secure Document Preservation Order',
      description: 'Obtain court order preventing document destruction',
      status: 'completed',
      priority: 'critical',
      category: 'legal',
      assigned_to: '550e8400-e29b-41d4-a716-446655440002',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      completed_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '2 days'"),
      created_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '10 days'"),
      updated_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '2 days'")
    }
  ]);
  
  // Insert sample communications
  await knex('communications').insert([
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440001',
      type: 'email',
      subject: 'Document Preservation Notice',
      content: 'This serves as formal notice that all documents related to the ESOP valuation must be preserved...',
      direction: 'outbound',
      from_stakeholder_id: '660e8400-e29b-41d4-a716-446655440001',
      to_stakeholder_id: '660e8400-e29b-41d4-a716-446655440008',
      initiated_by: '550e8400-e29b-41d4-a716-446655440002',
      status: 'sent',
      classification: 'confidential',
      thread_id: 'thread_001',
      sent_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '3 days'"),
      delivered_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '5 minutes'"),
      created_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '3 days'"),
      updated_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '3 days'")
    },
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440002',
      type: 'meeting',
      subject: 'Strategy Session - Case Planning',
      content: 'Discussed overall case strategy, witness preparation timeline, and media coordination',
      direction: 'inbound',
      from_stakeholder_id: '660e8400-e29b-41d4-a716-446655440003',
      to_stakeholder_id: '660e8400-e29b-41d4-a716-446655440001',
      initiated_by: '550e8400-e29b-41d4-a716-446655440003',
      status: 'delivered',
      classification: 'internal',
      sent_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '1 day'"),
      delivered_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '1 day'"),
      created_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '1 day'"),
      updated_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '1 day'")
    }
  ]);
  
  // Insert sample PR messages
  await knex('pr_messages').insert([
    {
      id: 'bb0e8400-e29b-41d4-a716-446655440001',
      title: 'Initial Case Announcement',
      content: 'Legal action filed on behalf of ESOP participants alleging fiduciary breaches...',
      message_type: 'press_release',
      target_audience: 'general_public',
      status: 'approved',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      approved_by: '550e8400-e29b-41d4-a716-446655440002',
      approval_chain: [
        {approver: '550e8400-e29b-41d4-a716-446655440002', status: 'approved', date: '2024-11-15'},
        {approver: '550e8400-e29b-41d4-a716-446655440001', status: 'approved', date: '2024-11-16'}
      ],
      key_messages: [
        'ESOP participants retirement funds at risk',
        'Fiduciary duties were breached',
        'Legal action seeks to protect workers'
      ],
      version_number: 1,
      approved_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '5 days'"),
      created_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '7 days'"),
      updated_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '5 days'")
    },
    {
      id: 'bb0e8400-e29b-41d4-a716-446655440002',
      title: 'FAQ for ESOP Participants',
      content: 'Frequently asked questions about the legal action and what it means for participants...',
      message_type: 'faq',
      target_audience: 'esop_participants',
      status: 'review',
      created_by: '550e8400-e29b-41d4-a716-446655440002',
      approval_chain: [
        {approver: '550e8400-e29b-41d4-a716-446655440001', status: 'pending', date: null}
      ],
      key_messages: [
        'Your rights are protected',
        'No cost to participate',
        'Information will be kept confidential'
      ],
      version_number: 1,
      created_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '2 days'"),
      updated_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '1 day'")
    }
  ]);
  
  // Insert sample risk assessments
  await knex('risk_assessments').insert([
    {
      id: 'cc0e8400-e29b-41d4-a716-446655440001',
      risk_type: 'evidence_destruction',
      title: 'Document Destruction Risk',
      description: 'Risk that defendant will destroy key financial documents before preservation order',
      probability: 8,
      impact: 9,
      status: 'mitigating',
      stakeholder_id: '660e8400-e29b-41d4-a716-446655440008',
      mitigation_strategy: 'Expedited motion for preservation order filed. Forensic accountant on standby.',
      contingency_plan: 'Subpoena backup systems and third-party records if primary documents destroyed',
      assigned_to: '550e8400-e29b-41d4-a716-446655440002',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      identified_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '10 days'"),
      next_review_date: knex.raw("CURRENT_TIMESTAMP + INTERVAL '7 days'"),
      created_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '10 days'"),
      updated_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '1 day'")
    },
    {
      id: 'cc0e8400-e29b-41d4-a716-446655440002',
      risk_type: 'retaliation',
      title: 'Witness Retaliation Risk',
      description: 'Former CFO may face employment retaliation or legal threats',
      probability: 6,
      impact: 7,
      status: 'monitoring',
      stakeholder_id: '660e8400-e29b-41d4-a716-446655440006',
      mitigation_strategy: 'Documented all communications. Advised witness of legal protections.',
      contingency_plan: 'File motion for protective order. Connect witness with employment attorney.',
      assigned_to: '550e8400-e29b-41d4-a716-446655440002',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      identified_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '5 days'"),
      next_review_date: knex.raw("CURRENT_TIMESTAMP + INTERVAL '14 days'"),
      created_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '5 days'"),
      updated_at: knex.raw("CURRENT_TIMESTAMP - INTERVAL '5 days'")
    },
    {
      id: 'cc0e8400-e29b-41d4-a716-446655440003',
      risk_type: 'reputation',
      title: 'Media Narrative Control',
      description: 'Defendant may launch preemptive PR campaign to control narrative',
      probability: 7,
      impact: 6,
      status: 'identified',
      mitigation_strategy: 'Prepare counter-messaging strategy. Build relationships with key journalists.',
      contingency_plan: 'Rapid response team activated. Social media monitoring in place.',
      assigned_to: '550e8400-e29b-41d4-a716-446655440001',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      identified_at: knex.fn.now(),
      next_review_date: knex.raw("CURRENT_TIMESTAMP + INTERVAL '3 days'"),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};