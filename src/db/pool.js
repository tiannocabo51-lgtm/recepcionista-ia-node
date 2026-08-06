const { Pool } = require('pg');
const config = require('../utils/config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[postgres] error inesperado en el pool:', err);
});

module.exports = pool;
