/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('communications', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('communication_type', ['email', 'call', 'meeting', 'letter']).notNullable();
    table.string('subject', 500);
    table.text('summary');
    table.jsonb('participants').notNullable(); // Array of stakeholder IDs
    table.uuid('initiated_by').references('id').inTable('stakeholders');
    table.timestamp('occurred_at').notNullable();
    table.integer('duration_minutes');
    table.string('location', 255);
    table.text('outcome');
    table.boolean('follow_up_required').defaultTo(false);
    table.timestamp('follow_up_date');
    table.boolean('sensitive_content').defaultTo(false);
    table.uuid('created_by').references('id').inTable('users').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['communication_type'], 'idx_communications_type');
    table.index(['occurred_at'], 'idx_communications_occurred_at');
    table.index(['created_by'], 'idx_communications_created_by');
    table.index(['follow_up_required'], 'idx_communications_follow_up_required');
    table.index(['sensitive_content'], 'idx_communications_sensitive_content');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('communications');
};