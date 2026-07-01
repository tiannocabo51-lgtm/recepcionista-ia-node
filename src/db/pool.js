const { Pool } = require('pg');
const config = require('../utils/config');

const pool = new Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  console.error('[postgres] error inesperado en el pool:', err);
});

module.exports = pool;
