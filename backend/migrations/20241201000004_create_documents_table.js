/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('documents', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title', 500).notNullable();
    table.text('description');
    table.string('file_path', 1000); // Encrypted file storage path
    table.string('file_hash', 128); // For integrity verification
    table.bigInteger('file_size');
    table.string('mime_type', 100);
    table.enum('classification', ['public', 'internal', 'confidential', 'secret']).notNullable();
    table.uuid('uploaded_by').references('id').inTable('users');
    table.integer('version_number').defaultTo(1);
    table.uuid('parent_document_id').references('id').inTable('documents'); // For version history
    table.uuid('encryption_key_id'); // Reference to encryption key
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['classification'], 'idx_documents_classification');
    table.index(['uploaded_by'], 'idx_documents_uploaded_by');
    table.index(['parent_document_id'], 'idx_documents_parent_document_id');
    table.index(['file_hash'], 'idx_documents_file_hash');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('documents');
};