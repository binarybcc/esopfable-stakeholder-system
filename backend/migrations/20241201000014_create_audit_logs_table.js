/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users');
    table.string('action', 100).notNullable();
    table.string('resource_type', 100);
    table.string('resource_id', 255);
    table.jsonb('old_values');
    table.jsonb('new_values');
    table.string('ip_address', 45);
    table.text('user_agent');
    table.string('session_id', 255);
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['user_id'], 'idx_audit_logs_user_id');
    table.index(['action'], 'idx_audit_logs_action');
    table.index(['resource_type'], 'idx_audit_logs_resource_type');
    table.index(['resource_id'], 'idx_audit_logs_resource_id');
    table.index(['timestamp'], 'idx_audit_logs_timestamp');
    table.index(['session_id'], 'idx_audit_logs_session_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};