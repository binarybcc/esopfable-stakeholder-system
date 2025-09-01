/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('evidence_items', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('document_id').references('id').inTable('documents');
    table.string('evidence_type', 100).notNullable();
    table.uuid('source_stakeholder_id').references('id').inTable('stakeholders');
    table.jsonb('chain_of_custody'); // Array of custody transfers
    table.string('integrity_hash', 128);
    table.boolean('authenticity_verified').defaultTo(false);
    table.uuid('verified_by').references('id').inTable('users');
    table.timestamp('verified_at');
    table.integer('significance_level').checkBetween([1, 10]);
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['document_id'], 'idx_evidence_items_document_id');
    table.index(['evidence_type'], 'idx_evidence_items_evidence_type');
    table.index(['source_stakeholder_id'], 'idx_evidence_items_source_stakeholder_id');
    table.index(['authenticity_verified'], 'idx_evidence_items_authenticity_verified');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('evidence_items');
};