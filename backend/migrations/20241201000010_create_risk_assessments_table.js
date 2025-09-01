/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('risk_assessments', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('risk_type', ['retaliation', 'evidence_destruction', 'legal', 'financial', 'reputation', 'physical', 'data_breach']).notNullable();
    table.string('title', 500).notNullable();
    table.text('description').notNullable();
    table.integer('probability').checkBetween([1, 10]).notNullable(); // 1-10 scale
    table.integer('impact').checkBetween([1, 10]).notNullable(); // 1-10 scale
    table.integer('risk_score').generatedAlwaysAs(knex.raw('probability * impact')); // Calculated field
    table.enum('status', ['identified', 'analyzing', 'mitigating', 'monitoring', 'resolved']).defaultTo('identified');
    table.uuid('stakeholder_id').references('id').inTable('stakeholders'); // Stakeholder at risk
    table.text('mitigation_strategy');
    table.text('contingency_plan');
    table.uuid('assigned_to').references('id').inTable('users');
    table.uuid('created_by').references('id').inTable('users').notNullable();
    table.timestamp('identified_at').defaultTo(knex.fn.now());
    table.timestamp('next_review_date');
    table.timestamp('resolved_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['risk_type'], 'idx_risk_assessments_risk_type');
    table.index(['risk_score'], 'idx_risk_assessments_risk_score');
    table.index(['status'], 'idx_risk_assessments_status');
    table.index(['stakeholder_id'], 'idx_risk_assessments_stakeholder_id');
    table.index(['assigned_to'], 'idx_risk_assessments_assigned_to');
    table.index(['next_review_date'], 'idx_risk_assessments_next_review_date');
    table.index(['probability', 'impact'], 'idx_risk_assessments_probability_impact');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('risk_assessments');
};