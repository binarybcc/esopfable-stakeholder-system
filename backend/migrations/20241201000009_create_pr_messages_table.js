/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('pr_messages', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title', 500).notNullable();
    table.text('content').notNullable();
    table.enum('message_type', ['press_release', 'statement', 'talking_points', 'faq', 'social_media', 'email_template']).notNullable();
    table.enum('target_audience', ['general_public', 'esop_participants', 'media', 'legal_team', 'government', 'employees']).notNullable();
    table.enum('status', ['draft', 'review', 'approved', 'published', 'archived']).defaultTo('draft');
    table.uuid('created_by').references('id').inTable('users').notNullable();
    table.uuid('approved_by').references('id').inTable('users');
    table.jsonb('approval_chain'); // Array of required approvers
    table.jsonb('key_messages'); // Array of key talking points
    table.jsonb('risk_factors'); // Potential risks and mitigations
    table.integer('version_number').defaultTo(1);
    table.uuid('parent_message_id').references('id').inTable('pr_messages');
    table.timestamp('approved_at');
    table.timestamp('published_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['message_type'], 'idx_pr_messages_message_type');
    table.index(['target_audience'], 'idx_pr_messages_target_audience');
    table.index(['status'], 'idx_pr_messages_status');
    table.index(['created_by'], 'idx_pr_messages_created_by');
    table.index(['approved_by'], 'idx_pr_messages_approved_by');
    table.index(['published_at'], 'idx_pr_messages_published_at');
    table.index(['parent_message_id'], 'idx_pr_messages_parent_message');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('pr_messages');
};