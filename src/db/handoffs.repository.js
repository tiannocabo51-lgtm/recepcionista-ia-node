const pool = require('./pool');

async function createHandoff(phone, reason) {
  await pool.query(
    `INSERT INTO handoffs (phone, reason) VALUES ($1, $2)`,
    [phone, reason]
  );
}

async function findRecent(limit = 20) {
  const result = await pool.query(
    `SELECT h.phone, h.reason, h.created_at,
            COALESCE(l.nombre, a.name) AS nombre
     FROM handoffs h
     LEFT JOIN leads l ON l.phone = h.phone
     LEFT JOIN LATERAL (
       SELECT name FROM appointments WHERE appointments.phone = h.phone
       ORDER BY created_at DESC LIMIT 1
     ) a ON true
     ORDER BY h.created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function countToday() {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM handoffs WHERE created_at >= CURRENT_DATE`
  );
  return result.rows[0].n;
}

module.exports = { createHandoff, findRecent, countToday };
