const pool = require('./pool');

async function createAppointment({ name, service, date, time, phone, notes }) {
  const result = await pool.query(
    `INSERT INTO appointments (name, service, appointment_date, appointment_time, phone, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, service, appointment_date, appointment_time, phone, status, created_at`,
    [name, service, date, time, phone, notes || null]
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

module.exports = { createAppointment, findUpcomingByPhone };
