import pg from 'pg';
import { config } from '../../config.js';
import { runMigrations } from './migrator.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export const connectPostgres = async (): Promise<void> => {
  try {
    pool = new Pool({
      host: config.postgresql.host,
      port: config.postgresql.port,
      database: config.postgresql.database,
      user: config.postgresql.username,
      password: config.postgresql.password,
    });

    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');

    await runMigrations(pool);
  } catch (err: any) {
    console.error('PostgreSQL connection error:', err.message);
    throw err;
  }
};

export const getPool = (): pg.Pool => {
  if (!pool) {
    throw new Error('PostgreSQL not connected. Call connectPostgres() first.');
  }
  return pool;
};

export const disconnectPostgres = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL disconnected');
  }
};
