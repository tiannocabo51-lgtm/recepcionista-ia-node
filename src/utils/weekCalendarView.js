const { getHoursForDate } = require('./businessHours');
const business = require('./businessConfig');

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const SLOT_MINUTES = 30;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function findServiceDuration(serviceName) {
  const target = (serviceName || '').trim().toLowerCase();
  const service =
    business.servicios.find((s) => s.nombre.toLowerCase() === target) ||
    business.servicios.find(
      (s) => s.nombre.toLowerCase().includes(target) || target.includes(s.nombre.toLowerCase())
    );
  return service ? service.duracionMinutos : 60;
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function renderWeekCalendar({ referenceDate, appointments, escapeHtml }) {
  const monday = mondayOf(referenceDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const hoursByDay = days.map((d) => getHoursForDate(d));

  const openDays = hoursByDay.filter(Boolean);
  if (!openDays.length) {
    return '<p class="empty">No hay horarios de atención configurados para esta semana.</p>';
  }

  const globalOpen = Math.min(...openDays.map((h) => h.openMin));
  const globalClose = Math.max(...openDays.map((h) => h.closeMin));
  const slotCount = Math.ceil((globalClose - globalOpen) / SLOT_MINUTES);

  const apptsByDay = days.map((d) =>
    appointments.filter((a) => a.appointment_date.toISOString().slice(0, 10) === d)
  );

  let cells = '';

  cells += `<div class="cal-cell cal-head cal-time-col"></div>`;
  days.forEach((d, i) => {
    const [, month, day] = d.split('-');
    cells += `<div class="cal-cell cal-head" style="grid-column:${i + 2}">${DAY_LABELS[i]}<br><span class="cal-date">${day}/${month}</span></div>`;
  });

  for (let s = 0; s < slotCount; s += 1) {
    const slotStart = globalOpen + s * SLOT_MINUTES;
    cells += `<div class="cal-cell cal-time-col" style="grid-row:${s + 2}">${formatMinutes(slotStart)}</div>`;
    days.forEach((d, i) => {
      const hours = hoursByDay[i];
      const isOpen = hours && slotStart >= hours.openMin && slotStart < hours.closeMin;
      cells += `<div class="cal-slot ${isOpen ? '' : 'cal-closed'}" style="grid-column:${i + 2};grid-row:${s + 2}"></div>`;
    });
  }

  days.forEach((d, i) => {
    apptsByDay[i].forEach((a) => {
      const start = toMinutes(a.appointment_time.slice(0, 5));
      const duration = findServiceDuration(a.service);
      const rowStart = Math.floor((start - globalOpen) / SLOT_MINUTES) + 2;
      const rowSpan = Math.max(1, Math.ceil(duration / SLOT_MINUTES));
      cells += `<div class="cal-appt status-${escapeHtml(a.status)}" style="grid-column:${i + 2};grid-row:${rowStart} / span ${rowSpan}">
        <strong>${a.appointment_time.slice(0, 5)}</strong> ${escapeHtml(a.name)}<br>
        <span class="cal-service">${escapeHtml(a.service)}</span>
      </div>`;
    });
  });

  return `<div class="cal-grid" style="grid-template-rows: auto repeat(${slotCount}, 26px);">${cells}</div>`;
}

module.exports = { renderWeekCalendar, mondayOf, addDays };
