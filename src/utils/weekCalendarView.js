const { getHoursForDate } = require('./businessHours');
const business = require('./businessConfig');

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const SLOT_MINUTES = 30;
const ROW_PX = 34;

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
    return '<p class="cal-empty">No hay horarios de atención configurados para esta semana.</p>';
  }

  const globalOpen = Math.min(...openDays.map((h) => h.openMin));
  const globalClose = Math.max(...openDays.map((h) => h.closeMin));
  const slotCount = Math.ceil((globalClose - globalOpen) / SLOT_MINUTES);
  const gridHeight = slotCount * ROW_PX;

  const todayStr = new Date().toISOString().slice(0, 10);

  const apptsByDay = days.map((d) =>
    appointments.filter((a) => a.appointment_date.toISOString().slice(0, 10) === d)
  );

  // Encabezado de días
  let head = '<div class="cal2-corner"></div>';
  days.forEach((d, i) => {
    const [, month, day] = d.split('-');
    const isToday = d === todayStr ? ' cal2-today' : '';
    head += `<div class="cal2-dayhead${isToday}"><span class="cal2-dayname">${DAY_LABELS[i]}</span><span class="cal2-daynum">${day}/${month}</span></div>`;
  });

  // Columna de horas
  let timeCol = '';
  for (let s = 0; s < slotCount; s += 1) {
    const slotStart = globalOpen + s * SLOT_MINUTES;
    const onHour = slotStart % 60 === 0;
    timeCol += `<div class="cal2-time" style="height:${ROW_PX}px">${onHour ? formatMinutes(slotStart) : ''}</div>`;
  }

  // Columnas por día
  let cols = '';
  days.forEach((d, i) => {
    const hours = hoursByDay[i];
    let slots = '';
    for (let s = 0; s < slotCount; s += 1) {
      const slotStart = globalOpen + s * SLOT_MINUTES;
      const isOpen = hours && slotStart >= hours.openMin && slotStart < hours.closeMin;
      const onHour = slotStart % 60 === 0 ? ' cal2-onhour' : '';
      slots += `<div class="cal2-slot ${isOpen ? 'cal2-open' : 'cal2-closed'}${onHour}" style="height:${ROW_PX}px"></div>`;
    }
    // Turnos posicionados en absoluto dentro de la columna
    let appts = '';
    apptsByDay[i].forEach((a) => {
      const start = toMinutes(a.appointment_time.slice(0, 5));
      const duration = findServiceDuration(a.service);
      const top = ((start - globalOpen) / SLOT_MINUTES) * ROW_PX;
      const rawHeight = (duration / SLOT_MINUTES) * ROW_PX - 2;
      const height = Math.max(ROW_PX - 2, rawHeight);
      const compact = height < 46 ? ' cal2-appt-compact' : '';
      const title = `${a.appointment_time.slice(0, 5)} · ${a.name} · ${a.service}`;
      appts += `<div class="cal2-appt st-${escapeHtml(a.status)}${compact}" style="top:${top}px;height:${height}px" title="${escapeHtml(title)}">
        <span class="cal2-appt-line"><span class="cal2-appt-time">${a.appointment_time.slice(0, 5)}</span> <span class="cal2-appt-name">${escapeHtml(a.name)}</span></span>
        <span class="cal2-appt-svc">${escapeHtml(a.service)}</span>
      </div>`;
    });
    cols += `<div class="cal2-col" style="height:${gridHeight}px">${slots}${appts}</div>`;
  });

  return `<div class="cal2">
    <div class="cal2-head">${head}</div>
    <div class="cal2-body">
      <div class="cal2-timecol">${timeCol}</div>
      <div class="cal2-cols">${cols}</div>
    </div>
  </div>`;
}

module.exports = { renderWeekCalendar, mondayOf, addDays };
