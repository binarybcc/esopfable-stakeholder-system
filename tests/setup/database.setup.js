const knex = require('knex');
const Redis = require('redis');
const path = require('path');

// Database setup for tests
let testDatabase = null;
let testRedis = null;

const setupTestDatabase = async () => {
  // PostgreSQL test database configuration
  const dbConfig = {
    client: 'postgresql',
    connection: {
      host: 'localhost',
      port: 5432,
      user: 'test_user',
      password: 'test_password',
      database: global.TEST_CONFIG.DB_NAME
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: path.join(__dirname, '../../backend/migrations')
    },
    seeds: {
      directory: path.join(__dirname, '../fixtures/seeds')
    }
  };

  try {
    // Create test database connection
    testDatabase = knex(dbConfig);
    global.testDatabase = testDatabase;

    // Run migrations
    await testDatabase.migrate.latest();
    
    console.log('Test database setup completed');
    return testDatabase;
  } catch (error) {
    console.error('Database setup failed:', error);
    throw error;
  }
};

const setupTestRedis = async () => {
  try {
    testRedis = Redis.createClient({
      url: process.env.REDIS_URL
    });

    await testRedis.connect();
    await testRedis.flushDb(); // Clear test Redis DB
    
    global.testRedis = testRedis;
    console.log('Test Redis setup completed');
    return testRedis;
  } catch (error) {
    console.error('Redis setup failed:', error);
    throw error;
  }
};

const cleanupTestDatabase = async () => {
  if (testDatabase) {
    // Rollback all migrations and close connection
    try {
      await testDatabase.migrate.rollback(undefined, true);
      await testDatabase.destroy();
    } catch (error) {
      console.error('Database cleanup error:', error);
    }
  }
};

const cleanupTestRedis = async () => {
  if (testRedis) {
    try {
      await testRedis.flushDb();
      await testRedis.quit();
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }
  }
};

// Database test utilities
const createTestTables = async (db) => {
  // Create test-specific tables if needed
  await db.schema.hasTable('test_sessions').then(exists => {
    if (!exists) {
      return db.schema.createTable('test_sessions', table => {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.string('name').notNullable();
        table.json('data').defaultTo('{}');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('expires_at');
      });
    }
  });

  await db.schema.hasTable('test_artifacts').then(exists => {
    if (!exists) {
      return db.schema.createTable('test_artifacts', table => {
        table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
        table.string('type').notNullable();
        table.string('file_path');
        table.json('metadata').defaultTo('{}');
        table.timestamp('created_at').defaultTo(db.fn.now());
      });
    }
  });
};

// Transaction helpers for isolated tests
const withTransaction = async (testFn) => {
  const trx = await testDatabase.transaction();
  
  try {
    await testFn(trx);
    await trx.rollback(); // Always rollback in tests
  } catch (error) {
    await trx.rollback();
    throw error;
  }
};

// Data seeding utilities
const seedTestData = async (db) => {
  // Insert test users
  const testUsers = [
    {
      id: 'test-legal-user-1',
      auth0_id: 'auth0|legal-user-1',
      email: 'legal1@example.com',
      role_type: 'legal_team',
      is_active: true
    },
    {
      id: 'test-esop-user-1',
      auth0_id: 'auth0|esop-user-1',
      email: 'esop1@example.com',
      role_type: 'esop_participant',
      is_active: true
    },
    {
      id: 'test-gov-user-1',
      auth0_id: 'auth0|gov-user-1',
      email: 'gov1@example.com',
      role_type: 'government_entity',
      is_active: true
    }
  ];

  await db('users').insert(testUsers).onConflict('id').ignore();

  // Insert test stakeholders
  const testStakeholders = [
    {
      id: 'test-stakeholder-1',
      user_id: 'test-esop-user-1',
      category: 'esop_participant',
      name: 'John Doe',
      organization: 'Test Corp',
      contact_info: JSON.stringify({ email: 'john@testcorp.com' }),
      metadata: JSON.stringify({ department: 'Engineering' }),
      security_level: 'standard'
    },
    {
      id: 'test-stakeholder-2',
      category: 'witness',
      name: 'Jane Smith',
      organization: 'Independent',
      contact_info: JSON.stringify({ email: 'jane@example.com' }),
      metadata: JSON.stringify({ role: 'Key Witness' }),
      security_level: 'high'
    }
  ];

  await db('stakeholders').insert(testStakeholders).onConflict('id').ignore();
};

// Database assertion helpers
const assertTableExists = async (tableName) => {
  const exists = await testDatabase.schema.hasTable(tableName);
  if (!exists) {
    throw new Error(`Table ${tableName} does not exist`);
  }
  return true;
};

const assertRecordExists = async (tableName, conditions) => {
  const record = await testDatabase(tableName).where(conditions).first();
  if (!record) {
    throw new Error(`Record not found in ${tableName} with conditions: ${JSON.stringify(conditions)}`);
  }
  return record;
};

const assertRecordCount = async (tableName, expectedCount, conditions = {}) => {
  const count = await testDatabase(tableName).where(conditions).count('* as count');
  const actualCount = parseInt(count[0].count);
  if (actualCount !== expectedCount) {
    throw new Error(`Expected ${expectedCount} records in ${tableName}, found ${actualCount}`);
  }
  return true;
};

// Export setup functions and utilities
module.exports = {
  setupTestDatabase,
  setupTestRedis,
  cleanupTestDatabase,
  cleanupTestRedis,
  createTestTables,
  withTransaction,
  seedTestData,
  assertTableExists,
  assertRecordExists,
  assertRecordCount,
  
  // Global helpers
  getTestDatabase: () => testDatabase,
  getTestRedis: () => testRedis
};

// Auto-setup for Jest
beforeAll(async () => {
  await setupTestDatabase();
  await setupTestRedis();
  await createTestTables(testDatabase);
  await seedTestData(testDatabase);
});

afterAll(async () => {
  await cleanupTestDatabase();
  await cleanupTestRedis();
});