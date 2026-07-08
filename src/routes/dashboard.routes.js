const express = require('express');
const dashboardAuth = require('../middleware/dashboardAuth');
const appointmentsRepo = require('../db/appointments.repository');
const conversationsRepo = require('../db/conversations.repository');
const handoffsRepo = require('../db/handoffs.repository');
const leadsRepo = require('../db/leads.repository');
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

const ESTADO_INFO = {
  nuevo: ['\u{1F195}', 'Nuevos'],
  consultando: ['\u{1F440}', 'Consultando'],
  turno: ['\u{1F4C5}', 'Con turno'],
  cliente: ['\u2B50', 'Clientes'],
  frio: ['\u2744', 'Frios'],
};

router.get('/dashboard/leads', async (req, res) => {
  const filtro = typeof req.query.estado === 'string' ? req.query.estado : null;
  const vista = req.query.vista === 'tablero' ? 'tablero' : 'lista';
  const [online, counts, leads] = await Promise.all([
    agentOnline(),
    leadsRepo.countByEstado(),
    leadsRepo.listLeads(vista === 'tablero' ? null : filtro),
  ]);

  const cards = Object.entries(ESTADO_INFO)
    .map(([est, info]) => {
      const activo = filtro === est && vista === 'lista' ? ' lead-card-active' : '';
      return '<a class="lead-card lc-' + est + activo + '" href="/dashboard/leads?estado=' + est + '">'
        + '<span class="lead-card-ico">' + info[0] + '</span>'
        + '<span class="lead-card-num">' + (counts[est] || 0) + '</span>'
        + '<span class="lead-card-lbl">' + info[1] + '</span></a>';
    })
    .join('');

  function chipsFor(interes) {
    return (interes || '').split(',').map((x) => x.trim()).filter(Boolean)
      .map((x) => '<span class="lead-chip">' + escapeHtml(x) + '</span>').join('');
  }

  // Vista LISTA
  const rows = leads.length
    ? leads.map((l) => {
        const inicial = (l.nombre || l.phone).trim().charAt(0).toUpperCase();
        return '<div class="lead-row">'
          + '<div class="lead-av">' + escapeHtml(inicial) + '</div>'
          + '<div class="lead-main"><div class="lead-name">' + escapeHtml(l.nombre || 'Sin nombre') + '</div>'
          + '<div class="lead-phone">' + escapeHtml(l.phone) + '</div></div>'
          + '<div class="lead-tags"><span class="pill pill-' + escapeHtml(l.estado) + '">' + (ESTADO_INFO[l.estado] ? ESTADO_INFO[l.estado][1] : l.estado) + '</span>' + chipsFor(l.interes) + '</div>'
          + '<div class="lead-when">' + fmtTime(l.ultimo_contacto) + '</div>'
          + '<a class="btn lead-btn" href="/dashboard/mensajes?phone=' + encodeURIComponent(l.phone) + '">Ver chat</a>'
          + '</div>';
      }).join('')
    : '<p class="empty" style="padding:32px;text-align:center">No hay leads en esta categoria.</p>';

  // Vista TABLERO (kanban)
  const columnas = Object.entries(ESTADO_INFO).map(([est, info]) => {
    const delEstado = leads.filter((l) => l.estado === est);
    const tarjetas = delEstado.length
      ? delEstado.map((l) =>
          '<a class="kan-card" href="/dashboard/mensajes?phone=' + encodeURIComponent(l.phone) + '">'
          + '<div class="kan-name">' + escapeHtml(l.nombre || 'Sin nombre') + '</div>'
          + '<div class="kan-phone">' + escapeHtml(l.phone) + '</div>'
          + (chipsFor(l.interes) ? '<div class="kan-chips">' + chipsFor(l.interes) + '</div>' : '')
          + '</a>'
        ).join('')
      : '<div class="kan-empty">—</div>';
    return '<div class="kan-col kc-' + est + '">'
      + '<div class="kan-head"><span>' + info[0] + ' ' + info[1] + '</span><span class="kan-count">' + delEstado.length + '</span></div>'
      + '<div class="kan-body">' + tarjetas + '</div></div>';
  }).join('');

  const toggle = '<div class="lead-toggle">'
    + '<a class="' + (vista === 'lista' ? 'tg-on' : '') + '" href="/dashboard/leads">Lista</a>'
    + '<a class="' + (vista === 'tablero' ? 'tg-on' : '') + '" href="/dashboard/leads?vista=tablero">Tablero</a>'
    + '</div>';

  const cuerpo = vista === 'tablero'
    ? '<div class="kanban">' + columnas + '</div>'
    : (filtro ? '<div class="toolbar"><a class="btn" href="/dashboard/leads">Ver todos</a></div>' : '') + rows;

  const filtroLabel = vista === 'lista' && filtro && ESTADO_INFO[filtro] ? ' Mostrando: ' + ESTADO_INFO[filtro][1] : ' Clientes clasificados automaticamente.';

  const content = '<style>'
    + '.lead-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:22px}'
    + '.lead-card{display:flex;flex-direction:column;gap:4px;padding:18px;border-radius:14px;border:1px solid var(--line);background:var(--card);text-decoration:none;color:var(--txt);transition:transform .16s,border-color .16s}'
    + '.lead-card:hover{transform:translateY(-2px)}'
    + '.lead-card-ico{font-size:1.15rem}.lead-card-num{font-size:1.9rem;font-weight:700;letter-spacing:-.03em}.lead-card-lbl{font-size:.78rem;color:var(--mut)}'
    + '.lc-nuevo{border-top:3px solid #94a3b8}.lc-consultando{border-top:3px solid var(--warn)}.lc-turno{border-top:3px solid var(--acc2)}.lc-cliente{border-top:3px solid var(--ok)}.lc-frio{border-top:3px solid #60a5fa}'
    + '.lead-card-active{border-color:var(--acc2);background:var(--card2)}'
    + '.lead-toggle{display:inline-flex;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:3px;margin-bottom:18px;gap:2px}'
    + '.lead-toggle a{padding:6px 16px;border-radius:8px;text-decoration:none;color:var(--mut);font-size:.84rem}'
    + '.lead-toggle a.tg-on{background:var(--acc);color:#fff}'
    + '.lead-row{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;background:var(--card);transition:border-color .16s}'
    + '.lead-row:hover{border-color:var(--acc2)}'
    + '.lead-av{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--acc),var(--acc2));display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}'
    + '.lead-main{min-width:130px}.lead-name{font-weight:600;font-size:.9rem}.lead-phone{font-size:.76rem;color:var(--mut);margin-top:2px}'
    + '.lead-tags{flex:1;display:flex;flex-wrap:wrap;gap:6px;align-items:center}'
    + '.lead-chip{font-size:.72rem;padding:3px 9px;border-radius:999px;background:var(--card2);color:var(--acc2);border:1px solid var(--line)}'
    + '.lead-when{font-size:.75rem;color:var(--mut);white-space:nowrap}.lead-btn{flex-shrink:0}'
    + '.pill-nuevo{background:rgba(148,163,173,.2);color:#cbd5e1}.pill-consultando{background:rgba(251,191,36,.15);color:var(--warn)}.pill-turno{background:rgba(99,102,241,.18);color:var(--acc2)}.pill-cliente{background:rgba(52,211,153,.15);color:var(--ok)}.pill-frio{background:rgba(96,165,250,.15);color:#60a5fa}'
    + '.kanban{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}'
    + '.kan-col{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;min-height:120px}'
    + '.kan-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;font-size:.8rem;font-weight:600;border-bottom:1px solid var(--line);background:var(--card2)}'
    + '.kan-count{background:var(--bg);border-radius:999px;padding:1px 8px;font-size:.72rem;color:var(--mut)}'
    + '.kc-nuevo .kan-head{border-top:3px solid #94a3b8}.kc-consultando .kan-head{border-top:3px solid var(--warn)}.kc-turno .kan-head{border-top:3px solid var(--acc2)}.kc-cliente .kan-head{border-top:3px solid var(--ok)}.kc-frio .kan-head{border-top:3px solid #60a5fa}'
    + '.kan-body{padding:10px;display:flex;flex-direction:column;gap:8px}'
    + '.kan-card{display:block;background:var(--card2);border:1px solid var(--line);border-radius:9px;padding:10px;text-decoration:none;color:var(--txt);transition:border-color .16s}'
    + '.kan-card:hover{border-color:var(--acc2)}'
    + '.kan-name{font-weight:600;font-size:.82rem}.kan-phone{font-size:.72rem;color:var(--mut);margin-top:2px}'
    + '.kan-chips{margin-top:6px;display:flex;flex-wrap:wrap;gap:4px}'
    + '.kan-empty{color:var(--mut);text-align:center;padding:16px;font-size:.8rem}'
    + '@media(max-width:900px){.kanban{grid-template-columns:1fr;}.kan-col{min-height:auto}}'
    + '@media(max-width:640px){.lead-row{flex-wrap:wrap}}'
    + '</style>'
    + '<h1>Leads</h1><p class="sub">' + filtroLabel + '</p>'
    + '<div class="lead-cards">' + cards + '</div>'
    + toggle
    + cuerpo;
  res.send(renderPage({ active: 'leads', agentOnline: online, content, wide: true }));
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
