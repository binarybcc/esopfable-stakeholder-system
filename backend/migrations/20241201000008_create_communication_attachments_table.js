/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('communication_attachments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('communication_id').references('id').inTable('communications').onDelete('CASCADE').notNullable();
    table.uuid('document_id').references('id').inTable('documents').onDelete('CASCADE').notNullable();
    table.string('attachment_type', 100);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['communication_id'], 'idx_communication_attachments_comm_id');
    table.index(['document_id'], 'idx_communication_attachments_doc_id');
    
    // Composite unique constraint
    table.unique(['communication_id', 'document_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('communication_attachments');
};