/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_permissions', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('permission_type', 100).notNullable();
    table.uuid('resource_id');
    table.timestamp('granted_at').defaultTo(knex.fn.now());
    table.uuid('granted_by').references('id').inTable('users');
    table.timestamp('expires_at');
    
    // Indexes
    table.index(['user_id'], 'idx_user_permissions_user_id');
    table.index(['permission_type'], 'idx_user_permissions_permission_type');
    table.index(['resource_id'], 'idx_user_permissions_resource_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('user_permissions');
};