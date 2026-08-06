const appointmentsRepo = require('../db/appointments.repository');
const pool = require('../db/pool');
const logger = require('../utils/logger');
const business = require('../utils/businessConfig');
const { getHoursForDate } = require('../utils/businessHours');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_DURATION_MIN = 60;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function findService(serviceName) {
  const target = serviceName.trim().toLowerCase();
  return (
    business.servicios.find((s) => s.nombre.toLowerCase() === target) ||
    business.servicios.find(
      (s) => s.nombre.toLowerCase().includes(target) || target.includes(s.nombre.toLowerCase())
    )
  );
}

function getDurationMinutes(serviceName) {
  const service = findService(serviceName);
  return service ? service.duracionMinutos : DEFAULT_DURATION_MIN;
}

async function checkAvailability({ date, time, service }) {
  const hours = getHoursForDate(date);
  if (!hours) {
    return { available: false, reason: 'Ese día no atendemos.' };
  }

  const duration = getDurationMinutes(service);
  const start = toMinutes(time);
  const end = start + duration;

  if (start < hours.openMin || end > hours.closeMin) {
    return {
      available: false,
      reason: `Ese horario no entra dentro de nuestra atención de ese día (el turno dura ${duration} min).`,
    };
  }

  const existing = await appointmentsRepo.findActiveByDate(date);
  for (const appt of existing) {
    const apptStart = toMinutes(appt.appointment_time.slice(0, 5));
    const apptEnd = apptStart + getDurationMinutes(appt.service);
    if (start < apptEnd && apptStart < end) {
      return { available: false, reason: 'Ese horario ya está ocupado, ¿tenés otro en mente?' };
    }
  }

  return { available: true };
}

async function createAppointment({ name, service, date, time, phone, notes }) {
  if (!DATE_RE.test(date)) {
    return { ok: false, error: 'La fecha debe tener formato YYYY-MM-DD.' };
  }
  if (!TIME_RE.test(time)) {
    return { ok: false, error: 'La hora debe tener formato HH:MM (24hs).' };
  }

  // Use a transaction to prevent race conditions (double-booking)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if this client already has an appointment at this date/time (duplicate prevention)
    const existRes = await client.query(
      `SELECT id, name, service, appointment_date::text AS appointment_date, appointment_time, status
       FROM appointments WHERE phone = $1 AND appointment_date >= CURRENT_DATE ORDER BY appointment_date`,
      [phone]
    );
    const duplicate = existRes.rows.find(a =>
      a.appointment_date === date &&
      a.appointment_time.slice(0, 5) === time &&
      a.status !== 'cancelado'
    );
    if (duplicate) {
      await client.query('ROLLBACK');
      return { ok: true, appointment: duplicate, alreadyExisted: true };
    }

    // Check availability with row-level lock
    const hours = getHoursForDate(date);
    if (!hours) {
      await client.query('ROLLBACK');
      return { ok: false, error: 'Ese día no atendemos.' };
    }
    const svc = findService(service);
    const duration = svc ? svc.duracionMinutos : DEFAULT_DURATION_MIN;
    const price = svc ? svc.precio : 0;
    const start = toMinutes(time);
    const end = start + duration;
    if (start < hours.openMin || end > hours.closeMin) {
      await client.query('ROLLBACK');
      return { ok: false, error: `Ese horario no entra dentro de nuestra atención (el turno dura ${duration} min).` };
    }

    // Lock existing appointments for that date to prevent concurrent inserts
    const lockRes = await client.query(
      `SELECT service, appointment_time FROM appointments WHERE appointment_date = $1 AND status != 'cancelado' FOR UPDATE`,
      [date]
    );
    for (const appt of lockRes.rows) {
      const apptStart = toMinutes(appt.appointment_time.slice(0, 5));
      const apptEnd = apptStart + getDurationMinutes(appt.service);
      if (start < apptEnd && apptStart < end) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Ese horario ya está ocupado, ¿tenés otro en mente?' };
      }
    }

    const insertRes = await client.query(
      `INSERT INTO appointments (name, service, appointment_date, appointment_time, phone, status, duration, price, deposit, color, professional, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, svc ? svc.nombre : service, date, time, phone, 'confirmado', duration, price, 0, null, 1, notes]
    );
    await client.query('COMMIT');
    return { ok: true, appointment: insertRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error al guardar turno:', err.message);
    return { ok: false, error: 'No se pudo guardar el turno en la base de datos.' };
  } finally {
    client.release();
  }
}

module.exports = { createAppointment };
