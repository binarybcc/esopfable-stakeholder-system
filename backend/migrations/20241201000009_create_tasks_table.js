/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('tasks', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title', 500).notNullable();
    table.text('description');
    table.string('task_type', 100);
    table.enum('priority', ['low', 'medium', 'high', 'critical']).defaultTo('medium');
    table.enum('status', ['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).defaultTo('pending');
    table.uuid('assigned_to').references('id').inTable('users');
    table.uuid('created_by').references('id').inTable('users').notNullable();
    table.timestamp('due_date');
    table.timestamp('completed_at');
    table.jsonb('depends_on').defaultTo('[]'); // Array of task IDs
    table.jsonb('stakeholder_ids').defaultTo('[]'); // Array of stakeholder IDs
    table.string('phase', 100);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['status'], 'idx_tasks_status');
    table.index(['priority'], 'idx_tasks_priority');
    table.index(['assigned_to'], 'idx_tasks_assigned_to');
    table.index(['created_by'], 'idx_tasks_created_by');
    table.index(['due_date'], 'idx_tasks_due_date');
    table.index(['phase'], 'idx_tasks_phase');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('tasks');
};