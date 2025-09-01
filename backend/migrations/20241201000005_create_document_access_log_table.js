/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('document_access_log', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('document_id').references('id').inTable('documents').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users');
    table.enum('action', ['view', 'download', 'edit', 'delete']).notNullable();
    table.inet('ip_address');
    table.text('user_agent');
    table.timestamp('accessed_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['document_id'], 'idx_document_access_log_document_id');
    table.index(['user_id'], 'idx_document_access_log_user_id');
    table.index(['accessed_at'], 'idx_document_access_log_accessed_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('document_access_log');
};