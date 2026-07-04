const appointmentsRepo = require('../db/appointments.repository');
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

  const availability = await checkAvailability({ date, time, service });
  if (!availability.available) {
    return { ok: false, error: availability.reason };
  }

  try {
    const appointment = await appointmentsRepo.createAppointment({
      name,
      service,
      date,
      time,
      phone,
      notes,
      status: 'confirmado',
    });
    return { ok: true, appointment };
  } catch (err) {
    logger.error('Error al guardar turno:', err.message);
    return { ok: false, error: 'No se pudo guardar el turno en la base de datos.' };
  }
}

module.exports = { createAppointment };
