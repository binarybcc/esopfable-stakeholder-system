/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('system_events', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('event_type', 100).notNullable();
    table.enum('severity', ['info', 'warning', 'error', 'critical']).notNullable();
    table.text('message').notNullable();
    table.jsonb('metadata');
    table.string('source', 100).notNullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['event_type'], 'idx_system_events_event_type');
    table.index(['severity'], 'idx_system_events_severity');
    table.index(['source'], 'idx_system_events_source');
    table.index(['timestamp'], 'idx_system_events_timestamp');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('system_events');
};