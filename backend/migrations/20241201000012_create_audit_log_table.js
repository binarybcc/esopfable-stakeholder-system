/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('audit_log', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users');
    table.enum('action_type', [
      'login',
      'logout', 
      'create',
      'read',
      'update',
      'delete',
      'upload',
      'download',
      'approve',
      'reject',
      'assign',
      'permission_change'
    ]).notNullable();
    table.string('resource_type', 100); // Table name or resource type
    table.uuid('resource_id'); // ID of affected resource
    table.jsonb('old_values'); // Previous state (for updates)
    table.jsonb('new_values'); // New state (for creates/updates)
    table.inet('ip_address');
    table.text('user_agent');
    table.string('session_id', 255);
    table.text('notes'); // Additional context
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    
    // Indexes for performance and compliance reporting
    table.index(['user_id'], 'idx_audit_log_user_id');
    table.index(['action_type'], 'idx_audit_log_action_type');
    table.index(['resource_type'], 'idx_audit_log_resource_type');
    table.index(['resource_id'], 'idx_audit_log_resource_id');
    table.index(['timestamp'], 'idx_audit_log_timestamp');
    table.index(['resource_type', 'resource_id'], 'idx_audit_log_resource_composite');
    
    // Partitioning by date for large audit logs (PostgreSQL specific)
    // This would need to be implemented separately with raw SQL
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('audit_log');
};