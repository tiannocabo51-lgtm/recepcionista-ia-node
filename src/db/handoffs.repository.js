const pool = require('./pool');

async function createHandoff(phone, reason) {
  await pool.query(
    `INSERT INTO handoffs (phone, reason) VALUES ($1, $2)`,
    [phone, reason]
  );
}

module.exports = { createHandoff };
