const business = require('./businessConfig');

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function parseHorario(horario) {
  if (/cerrado/i.test(horario)) return null;
  const match = horario.match(/(\d{1,2}):(\d{2})\s*a\s*(\d{1,2}):(\d{2})/i);
  if (!match) return null;
  const [, h1, m1, h2, m2] = match;
  return { openMin: Number(h1) * 60 + Number(m1), closeMin: Number(h2) * 60 + Number(m2) };
}

function getHoursForDayIndex(dayIndex) {
  const dayName = DAY_NAMES[dayIndex];
  const entry = business.horarios.find((h) => h.dia.toLowerCase().includes(dayName));
  if (!entry) return null;
  return parseHorario(entry.horario);
}

function getHoursForDate(dateStr) {
  const dayIndex = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return getHoursForDayIndex(dayIndex);
}

module.exports = { getHoursForDayIndex, getHoursForDate, DAY_NAMES };
