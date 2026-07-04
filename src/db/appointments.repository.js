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

module.exports = { createAppointment, findUpcomingByPhone, findActiveByDate, findUpcoming, findByDateRange };
