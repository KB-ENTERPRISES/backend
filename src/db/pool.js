// src/db/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host:                    process.env.DB_HOST,
  port:                    parseInt(process.env.DB_PORT || '5432'),
  database:                process.env.DB_NAME,
  user:                    process.env.DB_USER,
  password:                process.env.DB_PASSWORD,
  max:                     parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 10000,
  statement_timeout:       30000,
  application_name:        'kb-enterprises-backend',
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost'
    ? { rejectUnauthorized: true }
    : false,
});

pool.on('error', (err) => {
  console.error('[POOL] Unexpected database error:', err.message);
});

module.exports = pool;
