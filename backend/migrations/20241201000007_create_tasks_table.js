/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('tasks', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title', 500).notNullable();
    table.text('description');
    table.enum('status', ['pending', 'in_progress', 'completed', 'blocked', 'cancelled']).defaultTo('pending');
    table.enum('priority', ['low', 'medium', 'high', 'critical']).defaultTo('medium');
    table.enum('category', ['legal', 'investigation', 'pr', 'communication', 'evidence', 'security']).notNullable();
    table.uuid('assigned_to').references('id').inTable('users');
    table.uuid('created_by').references('id').inTable('users').notNullable();
    table.uuid('stakeholder_id').references('id').inTable('stakeholders');
    table.uuid('parent_task_id').references('id').inTable('tasks'); // For subtasks
    table.jsonb('dependencies'); // Array of task IDs that must be completed first
    table.timestamp('due_date');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for performance
    table.index(['status'], 'idx_tasks_status');
    table.index(['priority'], 'idx_tasks_priority');
    table.index(['category'], 'idx_tasks_category');
    table.index(['assigned_to'], 'idx_tasks_assigned_to');
    table.index(['created_by'], 'idx_tasks_created_by');
    table.index(['due_date'], 'idx_tasks_due_date');
    table.index(['parent_task_id'], 'idx_tasks_parent_task_id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('tasks');
};