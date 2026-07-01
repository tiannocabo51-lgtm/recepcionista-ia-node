const pool = require('./pool');

const HISTORY_LIMIT = 12;

async function saveMessage(phone, role, content) {
  await pool.query(
    `INSERT INTO conversations (phone, role, content) VALUES ($1, $2, $3)`,
    [phone, role, content]
  );
}

async function getRecentHistory(phone, limit = HISTORY_LIMIT) {
  const result = await pool.query(
    `SELECT role, content FROM conversations
     WHERE phone = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [phone, limit]
  );
  return result.rows.reverse();
}

module.exports = { saveMessage, getRecentHistory };
