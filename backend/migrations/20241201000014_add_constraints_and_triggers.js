/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Add check constraints
  await knex.raw(`
    ALTER TABLE stakeholders 
    ADD CONSTRAINT chk_stakeholders_category 
    CHECK (category IN ('legal_team', 'government_entities', 'esop_participants', 'key_witnesses', 'media_contacts', 'opposition'));
  `);
  
  await knex.raw(`
    ALTER TABLE documents 
    ADD CONSTRAINT chk_documents_version_number 
    CHECK (version_number > 0);
  `);
  
  await knex.raw(`
    ALTER TABLE evidence_items 
    ADD CONSTRAINT chk_evidence_items_significance_level 
    CHECK (significance_level BETWEEN 1 AND 10);
  `);
  
  // Add triggers for updated_at timestamps
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);
  
  // Apply the trigger to all tables with updated_at
  const tablesWithUpdatedAt = [
    'users', 'stakeholders', 'documents', 'tasks', 
    'communications', 'pr_messages', 'risk_assessments', 
    'document_templates'
  ];
  
  for (const tableName of tablesWithUpdatedAt) {
    await knex.raw(`
      CREATE TRIGGER update_${tableName}_updated_at 
      BEFORE UPDATE ON ${tableName} 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }
  
  // Add constraint to ensure evidence items have either document_id or standalone reference
  await knex.raw(`
    ALTER TABLE evidence_items 
    ADD CONSTRAINT chk_evidence_items_has_reference 
    CHECK (document_id IS NOT NULL OR (notes IS NOT NULL AND notes != ''));
  `);
  
  // Add constraint for communication thread consistency
  await knex.raw(`
    ALTER TABLE communications 
    ADD CONSTRAINT chk_communications_thread_consistency 
    CHECK (
      (parent_communication_id IS NULL AND thread_id IS NULL) OR
      (parent_communication_id IS NOT NULL AND thread_id IS NOT NULL)
    );
  `);
  
  // Add constraint for PR message approval workflow
  await knex.raw(`
    ALTER TABLE pr_messages 
    ADD CONSTRAINT chk_pr_messages_approval_workflow 
    CHECK (
      (status != 'approved' OR approved_by IS NOT NULL) AND
      (status != 'published' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
    );
  `);
  
  // Create function for audit logging
  await knex.raw(`
    CREATE OR REPLACE FUNCTION create_audit_log()
    RETURNS TRIGGER AS $$
    BEGIN
        INSERT INTO audit_log (
            action_type,
            resource_type,
            resource_id,
            old_values,
            new_values,
            timestamp
        ) VALUES (
            CASE 
                WHEN TG_OP = 'INSERT' THEN 'create'
                WHEN TG_OP = 'UPDATE' THEN 'update'
                WHEN TG_OP = 'DELETE' THEN 'delete'
            END,
            TG_TABLE_NAME,
            COALESCE(NEW.id, OLD.id),
            CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
            CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
            CURRENT_TIMESTAMP
        );
        RETURN COALESCE(NEW, OLD);
    END;
    $$ language 'plpgsql';
  `);
  
  // Apply audit triggers to sensitive tables
  const auditedTables = [
    'users', 'user_permissions', 'stakeholders', 
    'documents', 'evidence_items', 'pr_messages'
  ];
  
  for (const tableName of auditedTables) {
    await knex.raw(`
      CREATE TRIGGER audit_${tableName} 
      AFTER INSERT OR UPDATE OR DELETE ON ${tableName} 
      FOR EACH ROW EXECUTE FUNCTION create_audit_log();
    `);
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop audit triggers
  const auditedTables = [
    'users', 'user_permissions', 'stakeholders', 
    'documents', 'evidence_items', 'pr_messages'
  ];
  
  for (const tableName of auditedTables) {
    await knex.raw(`DROP TRIGGER IF EXISTS audit_${tableName} ON ${tableName}`);
  }
  
  // Drop updated_at triggers
  const tablesWithUpdatedAt = [
    'users', 'stakeholders', 'documents', 'tasks', 
    'communications', 'pr_messages', 'risk_assessments', 
    'document_templates'
  ];
  
  for (const tableName of tablesWithUpdatedAt) {
    await knex.raw(`DROP TRIGGER IF EXISTS update_${tableName}_updated_at ON ${tableName}`);
  }
  
  // Drop functions
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column()');
  await knex.raw('DROP FUNCTION IF EXISTS create_audit_log()');
  
  // Drop constraints
  await knex.raw('ALTER TABLE stakeholders DROP CONSTRAINT IF EXISTS chk_stakeholders_category');
  await knex.raw('ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_documents_version_number');
  await knex.raw('ALTER TABLE evidence_items DROP CONSTRAINT IF EXISTS chk_evidence_items_significance_level');
  await knex.raw('ALTER TABLE evidence_items DROP CONSTRAINT IF EXISTS chk_evidence_items_has_reference');
  await knex.raw('ALTER TABLE communications DROP CONSTRAINT IF EXISTS chk_communications_thread_consistency');
  await knex.raw('ALTER TABLE pr_messages DROP CONSTRAINT IF EXISTS chk_pr_messages_approval_workflow');
};