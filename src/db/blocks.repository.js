const pool = require('./pool');

async function list(from, to) {
  const result = await pool.query(
    `SELECT id, block_date::text AS block_date, from_min, duration, reason
     FROM blocks WHERE block_date >= $1 AND block_date <= $2
     ORDER BY block_date, from_min`,
    [from, to]
  );
  return result.rows;
}

async function create({ date, from, duration, reason }) {
  const result = await pool.query(
    `INSERT INTO blocks (block_date, from_min, duration, reason)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [date, from, duration, reason]
  );
  return result.rows[0];
}

async function update(id, { from, duration, reason }) {
  const result = await pool.query(
    `UPDATE blocks SET from_min=$1, duration=$2, reason=$3 WHERE id=$4 RETURNING *`,
    [from, duration, reason, id]
  );
  return result.rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM blocks WHERE id=$1', [id]);
}

async function overlaps(date, from, duration) {
  const result = await pool.query(
    `SELECT id FROM blocks WHERE block_date=$1 AND from_min < $2 + $3 AND from_min + duration > $2 LIMIT 1`,
    [date, from, duration]
  );
  return result.rows[0] || null;
}

module.exports = { list, create, update, remove, overlaps };
