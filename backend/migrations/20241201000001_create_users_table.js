/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('auth0_id', 255).unique().notNullable();
    table.string('email', 255).unique().notNullable();
    table.enum('role_type', [
      'legal_team',
      'government_entity', 
      'esop_participant',
      'witness',
      'media_contact',
      'opposition'
    ]).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('last_login');
    
    // Indexes
    table.index(['auth0_id'], 'idx_users_auth0_id');
    table.index(['email'], 'idx_users_email'); 
    table.index(['role_type'], 'idx_users_role_type');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('users');
};