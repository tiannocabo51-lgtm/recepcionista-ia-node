const express = require('express');
const dashboardAuth = require('../middleware/dashboardAuth');
const appointmentsRepo = require('../db/appointments.repository');
const conversationsRepo = require('../db/conversations.repository');
const handoffsRepo = require('../db/handoffs.repository');
const business = require('../utils/businessConfig');
const config = require('../utils/config');
const { renderPage, escapeHtml } = require('../utils/dashboardLayout');
const { renderWeekCalendar, mondayOf, addDays } = require('../utils/weekCalendarView');

const router = express.Router();
router.use('/dashboard', dashboardAuth);

async function agentOnline() {
  try {
    const r = await fetch(
      `${config.evolutionApiUrl}/instance/connectionState/${config.evolutionInstance}`,
      { headers: { apikey: config.evolutionApiKey }, signal: AbortSignal.timeout(1500) }
    );
    const j = await r.json();
    return (j.instance && j.instance.state) === 'open';
  } catch {
    return null;
  }
}

function fmtTime(d) {
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtDay(d) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const HOME_CSS = `<style>
  .hero { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:28px; }
  .hero .date { color:var(--mut); font-size:.9rem; text-transform:capitalize; }
  .chip { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.25rem; margin-bottom:14px; }
  .chip1 { background:rgba(99,102,241,.18); }
  .chip2 { background:rgba(52,211,153,.15); }
  .chip3 { background:rgba(251,191,36,.15); }
  .chip4 { background:rgba(248,113,113,.15); }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:28px; }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; }
  .panel h3 { font-size:.95rem; margin-bottom:10px; }
  .panel h3 a { float:right; font-size:.75rem; color:var(--acc2); text-decoration:none; font-weight:400; }
  .mini { display:flex; justify-content:space-between; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); font-size:.85rem; }
  .mini:last-child { border-bottom:none; }
  .mini-sub { display:block; color:var(--mut); font-size:.75rem; margin-top:2px; }
  .mini-right { color:var(--mut); font-size:.78rem; white-space:nowrap; }
  @media (max-width:760px) { .cols { grid-template-columns:1fr; } }
</style>`;

router.get('/dashboard', async (req, res) => {
  const t = today();
  const [online, turnosHoy, msgs, nuevos, derivs, proximos, convs] = await Promise.all([
    agentOnline(),
    appointmentsRepo.findByDateRange(t, t),
    conversationsRepo.countToday(),
    conversationsRepo.countNewClientsToday(),
    handoffsRepo.countToday(),
    appointmentsRepo.findUpcoming(5),
    conversationsRepo.listConversations(),
  ]);
  const stats = [
    ['chip1', '📅', 'Turnos hoy', turnosHoy.length],
    ['chip2', '💬', 'Mensajes hoy', msgs],
    ['chip3', '✨', 'Clientes nuevos hoy', nuevos],
    ['chip4', '🙋', 'Derivaciones hoy', derivs],
  ]
    .map(
      ([cls, ico, lbl, num]) =>
        `<div class="card"><div class="chip ${cls}">${ico}</div><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`
    )
    .join('');
  const turnosList = proximos.length
    ? proximos
        .map(
          (a) =>
            `<div class="mini"><div><strong>${escapeHtml(a.name)}</strong><span class="mini-sub">${escapeHtml(a.service)}</span></div><div class="mini-right">${fmtDay(a.appointment_date)} · ${a.appointment_time.slice(0, 5)}</div></div>`
        )
        .join('')
    : '<p class="empty">Sin turnos próximos.</p>';
  const convsList = convs.length
    ? convs
        .slice(0, 5)
        .map(
          (c) =>
            `<div class="mini"><div><strong>${escapeHtml(c.phone)}</strong><span class="mini-sub">${escapeHtml(c.content.slice(0, 48))}</span></div><div class="mini-right">${fmtTime(c.created_at)}</div></div>`
        )
        .join('')
    : '<p class="empty">Sin conversaciones aún.</p>';
  const hoyLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const content = `${HOME_CSS}
<div class="hero"><div><h1>Hola 👋</h1><p class="sub" style="margin-bottom:0">Así viene el día de ${escapeHtml(business.nombreRecepcionista)}.</p></div><div class="date">${hoyLabel}</div></div>
<div class="cards">${stats}</div>
<div class="cols">
  <div class="panel"><h3>Próximos turnos <a href="/dashboard/agenda">Ver agenda →</a></h3>${turnosList}</div>
  <div class="panel"><h3>Conversaciones recientes <a href="/dashboard/mensajes">Ver todas →</a></h3>${convsList}</div>
</div>`;
  res.send(renderPage({ active: 'inicio', agentOnline: online, content }));
});

router.get('/dashboard/agenda', async (req, res) => {
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(req.query.week) ? req.query.week : today();
  const monday = mondayOf(ref);
  const [online, appts] = await Promise.all([
    agentOnline(),
    appointmentsRepo.findByDateRange(monday, addDays(monday, 6)),
  ]);
  const cal = renderWeekCalendar({ referenceDate: monday, appointments: appts, escapeHtml });
  const content = `<style>
  .cal-head.cal-today { background:rgba(99,102,241,.3); color:#c7d2fe; }
</style>
<h1>Agenda</h1>
<p class="sub">Turnos confirmados y pendientes de la semana.</p>
<div class="toolbar">
  <a class="btn" href="/dashboard/agenda?week=${addDays(monday, -7)}">← Anterior</a>
  <div><strong>Semana del ${monday.split('-').reverse().join('/')}</strong> &nbsp; <a class="btn" href="/dashboard/agenda">Hoy</a></div>
  <a class="btn" href="/dashboard/agenda?week=${addDays(monday, 7)}">Siguiente →</a>
</div>
${cal}
<script>
  const hoy = new Date();
  const tag = String(hoy.getDate()).padStart(2, '0') + '/' + String(hoy.getMonth() + 1).padStart(2, '0');
  document.querySelectorAll('.cal-head').forEach((e) => { if (e.textContent.includes(tag)) e.classList.add('cal-today'); });
</script>`;
  res.send(renderPage({ active: 'agenda', agentOnline: online, content, wide: true }));
});

router.get('/dashboard/mensajes', async (req, res) => {
  const sel = typeof req.query.phone === 'string' ? req.query.phone : null;
  const [online, convs, chat] = await Promise.all([
    agentOnline(),
    conversationsRepo.listConversations(),
    sel ? conversationsRepo.findByPhone(sel) : Promise.resolve(null),
  ]);
  const items = convs.length
    ? convs
        .map(
          (c) => `
    <a class="conv-item${sel === c.phone ? ' sel' : ''}" href="/dashboard/mensajes?phone=${encodeURIComponent(c.phone)}">
      <div class="avatar">${escapeHtml(c.phone.slice(-2))}</div>
      <div class="conv-meta">
        <div class="conv-phone">${escapeHtml(c.phone)}</div>
        <div class="conv-last">${c.role === 'assistant' ? '🤖 ' : ''}${escapeHtml(c.content.slice(0, 60))}</div>
      </div>
      <div class="conv-time">${fmtTime(c.created_at)}</div>
    </a>`
        )
        .join('')
    : '<p class="empty">Todavía no hay conversaciones.</p>';
  const chatHtml =
    sel && chat
      ? `<div class="chat-head">${escapeHtml(sel)}</div>
    <div class="chat-msgs">${chat
      .map(
        (m) =>
          `<div class="bubble bubble-${m.role}">${escapeHtml(m.content)}<span class="t">${fmtTime(m.created_at)}</span></div>`
      )
      .join('')}</div>`
      : '<div class="chat-empty">Elegí una conversación para ver el chat</div>';
  const content = `<h1>Mensajes</h1>
<p class="sub">Conversaciones del agente con tus clientes.</p>
<div class="chat-wrap">
  <div class="conv-list">
    <div class="conv-search"><input placeholder="Buscar por número..." oninput="for(const e of document.querySelectorAll('.conv-item'))e.style.display=e.textContent.includes(this.value)?'':'none'"></div>
    ${items}
  </div>
  <div class="chat-pane">${chatHtml}</div>
</div>
<script>const m=document.querySelector('.chat-msgs');if(m)m.scrollTop=m.scrollHeight;</script>`;
  res.send(renderPage({ active: 'mensajes', agentOnline: online, content, wide: true }));
});

router.get('/dashboard/derivaciones', async (req, res) => {
  const [online, handoffs] = await Promise.all([agentOnline(), handoffsRepo.findRecent(50)]);
  const cards = handoffs.length
    ? handoffs
        .map(
          (h) => `
    <div class="hand-card">
      <div class="hand-info">
        <div class="hphone">${escapeHtml(h.phone)}</div>
        <div class="hdate">${fmtTime(h.created_at)}</div>
        <div class="hreason">${escapeHtml(h.reason)}</div>
      </div>
      <div><a class="btn" href="/dashboard/mensajes?phone=${encodeURIComponent(h.phone)}">Ver conversación</a></div>
    </div>`
        )
        .join('')
    : '<p class="empty">No hay derivaciones.</p>';
  const content = `<h1>Derivaciones</h1>
<p class="sub">Casos que el agente pasó a un humano.</p>
${cards}`;
  res.send(renderPage({ active: 'derivaciones', agentOnline: online, content }));
});

router.get('/dashboard/ajustes', async (req, res) => {
  const online = await agentOnline();
  const horarios = business.horarios
    .map((h) => `${escapeHtml(h.dia)}: ${escapeHtml(h.horario)}`)
    .join('<br>');
  const content = `<h1>Ajustes</h1>
<p class="sub">Configuración actual del agente. Por ahora se edita en el servidor; edición desde acá viene más adelante.</p>
<dl class="kv">
  <dt>Negocio</dt><dd>${escapeHtml(business.nombre)}</dd>
  <dt>Recepcionista virtual</dt><dd>${escapeHtml(business.nombreRecepcionista)}</dd>
  <dt>Instagram</dt><dd>${escapeHtml(business.instagram)}</dd>
  <dt>WhatsApp humano</dt><dd>${escapeHtml(business.whatsappHumano)}</dd>
  <dt>Dirección</dt><dd>${escapeHtml(business.ubicacion.direccion)}, ${escapeHtml(business.ubicacion.ciudad)}</dd>
  <dt>Horarios</dt><dd>${horarios}</dd>
  <dt>Servicios cargados</dt><dd>${business.servicios.length}</dd>
  <dt>Usuario del panel</dt><dd>${escapeHtml(config.dashboardUser)}</dd>
</dl>`;
  res.send(renderPage({ active: 'ajustes', agentOnline: online, content }));
});

module.exports = router;
