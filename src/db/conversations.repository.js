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

async function listConversations() {
  const result = await pool.query(
    `SELECT c.phone, c.content, c.role, c.created_at, t.total
     FROM (
       SELECT DISTINCT ON (phone) phone, content, role, created_at
       FROM conversations ORDER BY phone, created_at DESC
     ) c
     JOIN (
       SELECT phone, COUNT(*) AS total FROM conversations GROUP BY phone
     ) t ON t.phone = c.phone
     ORDER BY c.created_at DESC`
  );
  return result.rows;
}

async function findByPhone(phone, limit = 200) {
  const result = await pool.query(
    `SELECT role, content, created_at FROM conversations
     WHERE phone = $1 ORDER BY created_at ASC LIMIT $2`,
    [phone, limit]
  );
  return result.rows;
}

async function countToday() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM conversations WHERE created_at >= CURRENT_DATE`
  );
  return result.rows[0].n;
}

async function countNewClientsToday() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT phone, MIN(created_at) AS first_at FROM conversations GROUP BY phone
     ) x WHERE x.first_at >= CURRENT_DATE`
  );
  return result.rows[0].n;
}

async function countByPhone(phone) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM conversations WHERE phone = $1 AND role = 'user'`,
    [phone]
  );
  return r.rows[0].n;
}

module.exports = {
  saveMessage,
  getRecentHistory,
  listConversations,
  findByPhone,
  countToday,
  countNewClientsToday,
  countByPhone,
};
