const appointmentsRepo = require('../db/appointments.repository');
const logger = require('../utils/logger');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function createAppointment({ name, service, date, time, phone, notes }) {
  if (!DATE_RE.test(date)) {
    return { ok: false, error: 'La fecha debe tener formato YYYY-MM-DD.' };
  }
  if (!TIME_RE.test(time)) {
    return { ok: false, error: 'La hora debe tener formato HH:MM (24hs).' };
  }

  try {
    const appointment = await appointmentsRepo.createAppointment({
      name,
      service,
      date,
      time,
      phone,
      notes,
    });
    return { ok: true, appointment };
  } catch (err) {
    logger.error('Error al guardar turno:', err.message);
    return { ok: false, error: 'No se pudo guardar el turno en la base de datos.' };
  }
}

module.exports = { createAppointment };
