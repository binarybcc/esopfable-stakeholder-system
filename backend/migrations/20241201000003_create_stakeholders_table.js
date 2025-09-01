/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('stakeholders', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users');
    table.string('category', 50).notNullable();
    table.string('subcategory', 100);
    table.string('name', 255).notNullable();
    table.string('organization', 255);
    table.string('title', 255);
    table.jsonb('contact_info'); // Encrypted storage
    table.jsonb('metadata'); // Category-specific fields
    table.enum('security_level', ['standard', 'restricted', 'high']).defaultTo('standard');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index(['category'], 'idx_stakeholders_category');
    table.index(['security_level'], 'idx_stakeholders_security_level');
    table.index(['user_id'], 'idx_stakeholders_user_id');
    table.index(['name'], 'idx_stakeholders_name');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('stakeholders');
};