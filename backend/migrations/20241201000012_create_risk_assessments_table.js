/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('risk_assessments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('stakeholder_id').references('id').inTable('stakeholders').onDelete('CASCADE').notNullable();
    table.string('risk_category', 100).notNullable();
    table.integer('risk_level').notNullable().checkBetween([1, 10]);
    table.text('assessment_notes');
    table.jsonb('protective_measures').defaultTo('[]'); // Array of strings
    table.uuid('assessed_by').references('id').inTable('users').notNullable();
    table.timestamp('assessment_date').defaultTo(knex.fn.now());
    table.timestamp('next_review_date');
    
    // Indexes
    table.index(['stakeholder_id'], 'idx_risk_assessments_stakeholder_id');
    table.index(['risk_category'], 'idx_risk_assessments_risk_category');
    table.index(['risk_level'], 'idx_risk_assessments_risk_level');
    table.index(['assessed_by'], 'idx_risk_assessments_assessed_by');
    table.index(['assessment_date'], 'idx_risk_assessments_assessment_date');
    table.index(['next_review_date'], 'idx_risk_assessments_next_review_date');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('risk_assessments');
};