/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('document_templates', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.text('description');
    table.enum('template_type', [
      'legal_filing',
      'correspondence',
      'press_release',
      'internal_memo',
      'witness_interview',
      'evidence_log',
      'meeting_notes',
      'status_report'
    ]).notNullable();
    table.text('template_content').notNullable(); // Template with placeholders
    table.jsonb('required_fields'); // Array of field definitions
    table.jsonb('optional_fields'); // Array of optional field definitions
    table.enum('classification', ['public', 'internal', 'confidential', 'secret']).defaultTo('internal');
    table.boolean('is_active').defaultTo(true);
    table.uuid('created_by').references('id').inTable('users').notNullable();
    table.integer('usage_count').defaultTo(0);
    table.timestamp('last_used');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['template_type'], 'idx_document_templates_template_type');
    table.index(['classification'], 'idx_document_templates_classification');
    table.index(['is_active'], 'idx_document_templates_is_active');
    table.index(['created_by'], 'idx_document_templates_created_by');
    table.index(['usage_count'], 'idx_document_templates_usage_count');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('document_templates');
};