/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('pr_messages', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('message_type', 100);
    table.string('title', 500).notNullable();
    table.text('content').notNullable();
    table.jsonb('target_audience').defaultTo('[]'); // Array of audience categories
    table.enum('approval_status', ['draft', 'review', 'approved', 'published', 'archived']).defaultTo('draft');
    table.uuid('created_by').references('id').inTable('users').notNullable();
    table.uuid('approved_by').references('id').inTable('users');
    table.timestamp('published_at');
    table.integer('version_number').defaultTo(1);
    table.uuid('parent_message_id').references('id').inTable('pr_messages');
    table.jsonb('stakeholder_coordination').defaultTo('{}'); // Coordination metadata
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['message_type'], 'idx_pr_messages_message_type');
    table.index(['approval_status'], 'idx_pr_messages_approval_status');
    table.index(['created_by'], 'idx_pr_messages_created_by');
    table.index(['approved_by'], 'idx_pr_messages_approved_by');
    table.index(['published_at'], 'idx_pr_messages_published_at');
    table.index(['parent_message_id'], 'idx_pr_messages_parent_message_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('pr_messages');
};