/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('risk_events', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('event_type', 100).notNullable();
    table.integer('severity_level').notNullable().checkBetween([1, 10]);
    table.text('description').notNullable();
    table.jsonb('affected_stakeholders').defaultTo('[]'); // Array of stakeholder IDs
    table.uuid('reported_by').references('id').inTable('users').notNullable();
    table.boolean('verified').defaultTo(false);
    table.uuid('verified_by').references('id').inTable('users');
    table.jsonb('mitigation_actions').defaultTo('[]'); // Array of strings
    table.enum('status', ['open', 'investigating', 'mitigated', 'closed']).defaultTo('open');
    table.timestamp('occurred_at');
    table.timestamp('reported_at').defaultTo(knex.fn.now());
    table.timestamp('resolved_at');
    
    // Indexes
    table.index(['event_type'], 'idx_risk_events_event_type');
    table.index(['severity_level'], 'idx_risk_events_severity_level');
    table.index(['status'], 'idx_risk_events_status');
    table.index(['reported_by'], 'idx_risk_events_reported_by');
    table.index(['verified'], 'idx_risk_events_verified');
    table.index(['occurred_at'], 'idx_risk_events_occurred_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('risk_events');
};