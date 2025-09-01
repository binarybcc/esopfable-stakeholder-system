/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('communications', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('type', ['email', 'phone', 'meeting', 'letter', 'secure_message', 'press_release']).notNullable();
    table.string('subject', 500);
    table.text('content'); // Encrypted content
    table.enum('direction', ['inbound', 'outbound']).notNullable();
    table.uuid('from_stakeholder_id').references('id').inTable('stakeholders');
    table.uuid('to_stakeholder_id').references('id').inTable('stakeholders');
    table.jsonb('additional_recipients'); // Array of stakeholder IDs
    table.uuid('initiated_by').references('id').inTable('users');
    table.enum('status', ['draft', 'sent', 'delivered', 'read', 'replied']).defaultTo('draft');
    table.enum('classification', ['public', 'internal', 'confidential', 'secret']).defaultTo('internal');
    table.uuid('thread_id'); // For grouping related communications
    table.uuid('parent_communication_id').references('id').inTable('communications');
    table.jsonb('attachments'); // Array of document IDs
    table.timestamp('sent_at');
    table.timestamp('delivered_at');
    table.timestamp('read_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['type'], 'idx_communications_type');
    table.index(['direction'], 'idx_communications_direction');
    table.index(['from_stakeholder_id'], 'idx_communications_from_stakeholder');
    table.index(['to_stakeholder_id'], 'idx_communications_to_stakeholder');
    table.index(['status'], 'idx_communications_status');
    table.index(['classification'], 'idx_communications_classification');
    table.index(['thread_id'], 'idx_communications_thread_id');
    table.index(['sent_at'], 'idx_communications_sent_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('communications');
};