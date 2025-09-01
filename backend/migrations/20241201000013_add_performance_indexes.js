/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // Add composite indexes for common query patterns
  await knex.schema.alterTable('stakeholders', function(table) {
    table.index(['category', 'security_level'], 'idx_stakeholders_category_security');
    table.index(['organization', 'name'], 'idx_stakeholders_org_name');
  });
  
  await knex.schema.alterTable('documents', function(table) {
    table.index(['classification', 'uploaded_by'], 'idx_documents_classification_uploader');
    table.index(['created_at', 'classification'], 'idx_documents_created_classification');
  });
  
  await knex.schema.alterTable('user_permissions', function(table) {
    table.index(['user_id', 'permission_type'], 'idx_user_permissions_user_permission');
    table.index(['expires_at'], 'idx_user_permissions_expires_at');
  });
  
  await knex.schema.alterTable('evidence_items', function(table) {
    table.index(['significance_level', 'authenticity_verified'], 'idx_evidence_significance_verified');
    table.index(['created_at'], 'idx_evidence_items_created_at');
  });
  
  // Add full-text search indexes for PostgreSQL
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_documents_title_fulltext 
    ON documents USING gin(to_tsvector('english', title));
  `);
  
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_documents_description_fulltext 
    ON documents USING gin(to_tsvector('english', description));
  `);
  
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_stakeholders_name_fulltext 
    ON stakeholders USING gin(to_tsvector('english', name));
  `);
  
  // Add partial indexes for active records
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_users_active 
    ON users (id, role_type) WHERE is_active = true;
  `);
  
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_document_templates_active 
    ON document_templates (template_type, name) WHERE is_active = true;
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Drop composite indexes
  await knex.schema.alterTable('stakeholders', function(table) {
    table.dropIndex([], 'idx_stakeholders_category_security');
    table.dropIndex([], 'idx_stakeholders_org_name');
  });
  
  await knex.schema.alterTable('documents', function(table) {
    table.dropIndex([], 'idx_documents_classification_uploader');
    table.dropIndex([], 'idx_documents_created_classification');
  });
  
  await knex.schema.alterTable('user_permissions', function(table) {
    table.dropIndex([], 'idx_user_permissions_user_permission');
    table.dropIndex([], 'idx_user_permissions_expires_at');
  });
  
  await knex.schema.alterTable('evidence_items', function(table) {
    table.dropIndex([], 'idx_evidence_significance_verified');
    table.dropIndex([], 'idx_evidence_items_created_at');
  });
  
  // Drop full-text search indexes
  await knex.raw('DROP INDEX IF EXISTS idx_documents_title_fulltext');
  await knex.raw('DROP INDEX IF EXISTS idx_documents_description_fulltext');
  await knex.raw('DROP INDEX IF EXISTS idx_stakeholders_name_fulltext');
  await knex.raw('DROP INDEX IF EXISTS idx_users_active');
  await knex.raw('DROP INDEX IF EXISTS idx_document_templates_active');
};