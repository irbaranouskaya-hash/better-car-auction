import pg from 'pg';
import { config } from '../config.js';
import { runMigrations, getMigrationStatus } from '../db/postgresql/migrator.js';

const { Pool } = pg;

const main = async () => {
  const command = process.argv[2];

  const pool = new Pool({
    host: config.postgresql.host,
    port: config.postgresql.port,
    database: config.postgresql.database,
    user: config.postgresql.username,
    password: config.postgresql.password,
  });

  try {
    if (command === 'status') {
      const migrations = await getMigrationStatus(pool);
      if (migrations.length === 0) {
        console.log('No migrations have been executed yet.');
      } else {
        console.log('Executed migrations:');
        for (const m of migrations) {
          console.log(`  - ${m.name} (${m.executed_at.toISOString()})`);
        }
      }
    } else {
      await runMigrations(pool);
    }
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

main();

