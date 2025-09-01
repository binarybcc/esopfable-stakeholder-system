/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('task_updates', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('task_id').references('id').inTable('tasks').onDelete('CASCADE').notNullable();
    table.uuid('user_id').references('id').inTable('users').notNullable();
    table.enum('update_type', ['status_change', 'comment', 'assignment']).notNullable();
    table.string('old_value', 255);
    table.string('new_value', 255);
    table.text('comment');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['task_id'], 'idx_task_updates_task_id');
    table.index(['user_id'], 'idx_task_updates_user_id');
    table.index(['update_type'], 'idx_task_updates_update_type');
    table.index(['created_at'], 'idx_task_updates_created_at');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('task_updates');
};