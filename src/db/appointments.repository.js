const pool = require('./pool');

async function createAppointment({ name, service, date, time, phone, notes, status }) {
  const result = await pool.query(
    `INSERT INTO appointments (name, service, appointment_date, appointment_time, phone, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'pendiente'))
     RETURNING id, name, service, appointment_date, appointment_time, phone, status, created_at`,
    [name, service, date, time, phone, notes || null, status || null]
  );
  return result.rows[0];
}

async function findUpcomingByPhone(phone) {
  const result = await pool.query(
    `SELECT id, name, service, appointment_date, appointment_time, status
     FROM appointments
     WHERE phone = $1 AND appointment_date >= CURRENT_DATE
     ORDER BY appointment_date, appointment_time`,
    [phone]
  );
  return result.rows;
}

async function findActiveByDate(date) {
  const result = await pool.query(
    `SELECT service, appointment_time
     FROM appointments
     WHERE appointment_date = $1 AND status != 'cancelado'`,
    [date]
  );
  return result.rows;
}

async function findUpcoming(limit = 50) {
  const result = await pool.query(
    `SELECT id, name, service, appointment_date, appointment_time, phone, status
     FROM appointments
     WHERE appointment_date >= CURRENT_DATE
     ORDER BY appointment_date, appointment_time
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function findByDateRange(startDate, endDate) {
  const result = await pool.query(
    `SELECT id, name, service, appointment_date, appointment_time, phone, status
     FROM appointments
     WHERE appointment_date >= $1 AND appointment_date <= $2 AND status != 'cancelado'
     ORDER BY appointment_date, appointment_time`,
    [startDate, endDate]
  );
  return result.rows;
}

async function findRange(from, to) {
  const result = await pool.query(
    `SELECT id, name, service, appointment_date::text AS appointment_date,
            appointment_time, phone, status, notes,
            duration, price, deposit, color, professional,
            EXTRACT(HOUR FROM appointment_time)::int * 60 + EXTRACT(MINUTE FROM appointment_time)::int AS from_min
     FROM appointments
     WHERE appointment_date >= $1 AND appointment_date <= $2
     ORDER BY appointment_date, appointment_time`,
    [from, to]
  );
  return result.rows;
}

async function saveFull({ id, name, phone, service, date, time, from_min, duration, status, color, price, deposit, professional, notes }) {
  if (id) {
    const result = await pool.query(
      `UPDATE appointments SET name=$1, service=$2, appointment_date=$3, appointment_time=$4,
              phone=$5, status=$6, duration=$7, price=$8, deposit=$9, color=$10, professional=$11, notes=$12
       WHERE id=$13 RETURNING *`,
      [name, service, date, time, phone, status, duration, price, deposit, color, professional, notes, id]
    );
    return result.rows[0];
  }
  const result = await pool.query(
    `INSERT INTO appointments (name, service, appointment_date, appointment_time, phone, status, duration, price, deposit, color, professional, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [name, service, date, time, phone, status || 'pendiente', duration, price, deposit, color, professional, notes]
  );
  return result.rows[0];
}

async function move(id, date, time, from_min, duration) {
  await pool.query(
    `UPDATE appointments SET appointment_date=$1, appointment_time=$2, duration=$3 WHERE id=$4`,
    [date, time, duration, id]
  );
}

module.exports = { createAppointment, findUpcomingByPhone, findActiveByDate, findUpcoming, findByDateRange, findRange, saveFull, move };
