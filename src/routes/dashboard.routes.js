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
const agendaView = require('../utils/agendaView');
const blocksRepo = require('../db/blocks.repository');

const router = express.Router();
const B = config.basePath; // e.g. '/simaxface' or ''
router.use('/dashboard', dashboardAuth);

router.post('/dashboard/api/toggle-ai', express.json(), async (req, res) => {
  const { phone, enabled } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });
  await leadsRepo.toggleAi(phone, enabled !== false);
  res.json({ ok: true, phone, ai_enabled: enabled !== false });
});

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
  const confirmados = turnosHoy.filter(a => a.status === 'confirmado').length;
  const cancelados = turnosHoy.filter(a => a.status === 'cancelado').length;
  const pendientes = turnosHoy.filter(a => a.status === 'pendiente').length;
  const stats = [
    ['chip1', '📅', 'Turnos hoy', turnosHoy.length, `${confirmados} confirmados · ${pendientes} pendientes`, `${B}/dashboard/agenda`],
    ['chip2', '✅', 'Confirmados', confirmados, 'listos para atender', `${B}/dashboard/agenda`],
    ['chip3', '✨', 'Clientes nuevos', nuevos, 'primera vez hoy', `${B}/dashboard/leads?estado=nuevo`],
    ['chip4', '🙋', 'Derivaciones', derivs, 'pasadas a humano', `${B}/dashboard/derivaciones`],
  ]
    .map(
      ([cls, ico, lbl, num, sub, href]) =>
        `<a class="card" href="${href}" style="text-decoration:none;color:inherit"><div class="chip ${cls}">${ico}</div><div class="num">${num}</div><div class="lbl">${lbl}</div><div class="lbl" style="margin-top:2px;font-size:.7rem">${sub}</div></a>`
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
            `<div class="mini"><div><strong>${escapeHtml(c.nombre || c.phone)}</strong><span class="mini-sub">${escapeHtml(c.content.slice(0, 48))}</span></div><div class="mini-right">${fmtTime(c.created_at)}</div></div>`
        )
        .join('')
    : '<p class="empty">Sin conversaciones aún.</p>';
  const hoyLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const content = `${HOME_CSS}
<div class="hero"><div><h1>Hola 👋</h1><p class="sub" style="margin-bottom:0">Así viene el día de ${escapeHtml(business.nombreRecepcionista)}.</p></div><div class="date">${hoyLabel}</div></div>
<div class="cards">${stats}</div>
<div class="cols">
  <div class="panel"><h3>Próximos turnos <a href="${B}/dashboard/agenda">Ver agenda →</a></h3>${turnosList}</div>
  <div class="panel"><h3>Conversaciones recientes <a href="${B}/dashboard/mensajes">Ver todas →</a></h3>${convsList}</div>
</div>`;
  res.send(renderPage({ active: 'inicio', agentOnline: online, content }));
});

// ── Agenda interactiva (agendaView.html) ──────────────────────────────
router.get('/dashboard/agenda', async (req, res) => {
  const online = await agentOnline();
  const statusDot = online === true ? '<span class="dot dot-on"></span>' : online === false ? '<span class="dot dot-off"></span>' : '<span class="dot dot-unk"></span>';
  // Inject BASE_PATH and wrap in HTML shell with nav
  const body = agendaView().replace(
    '<script>',
    `<script>window.__BASE_PATH__=${JSON.stringify(B)};`,
  );
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(business.nombre)} - Agenda</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0b0f1a;--card:#121828;--card2:#171f33;--line:#232d47;--txt:#e6eaf2;--mut:#8b96ad;--acc:#6366f1;--acc2:#818cf8;--ok:#34d399;--warn:#fbbf24;--bad:#f87171}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--txt);min-height:100vh}
.dash-nav{position:sticky;top:0;z-index:80;display:flex;align-items:center;gap:16px;padding:12px 22px;background:rgba(11,15,26,.88);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.dash-brand{font-weight:700;font-size:1rem;letter-spacing:-.02em;white-space:nowrap}
.dash-status{font-size:.72rem;color:var(--mut);display:flex;align-items:center;gap:5px}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.dot-on{background:var(--ok);box-shadow:0 0 8px var(--ok)}.dot-off{background:var(--bad);box-shadow:0 0 8px var(--bad)}.dot-unk{background:var(--mut)}
.dash-links{margin-left:auto;display:flex;gap:3px;flex-wrap:wrap}
.dash-links a{color:var(--mut);text-decoration:none;font-size:.82rem;padding:6px 12px;border-radius:8px;transition:.16s;white-space:nowrap}
.dash-links a:hover{color:var(--txt);background:var(--card2)}
.dash-links a.active{color:#fff;background:var(--acc)}
#menu-toggle,.hamburger{display:none}
@media(max-width:760px){
  .dash-nav{padding:10px 14px;flex-wrap:wrap;gap:8px}
  .hamburger{display:block;margin-left:auto;font-size:1.3rem;cursor:pointer;color:var(--txt)}
  .dash-links{display:none;width:100%;flex-direction:column;margin:4px 0 0}
  #menu-toggle:checked ~ .dash-links{display:flex}
  .dash-links a{padding:10px 14px;font-size:.9rem}
}
</style>
</head><body>
<nav class="dash-nav">
  <div><div class="dash-brand">${escapeHtml(business.nombre)}</div><div class="dash-status">${statusDot} ${online === true ? 'En línea' : online === false ? 'Desconectado' : 'Estado desconocido'}</div></div>
  <input type="checkbox" id="menu-toggle"><label for="menu-toggle" class="hamburger">☰</label>
  <div class="dash-links">
    <a href="${B}/dashboard">Inicio</a>
    <a href="${B}/dashboard/agenda" class="active">Agenda</a>
    <a href="${B}/dashboard/mensajes">Mensajes</a>
    <a href="${B}/dashboard/leads">Leads</a>
    <a href="${B}/dashboard/derivaciones">Derivaciones</a>
    <a href="${B}/dashboard/ajustes">Ajustes</a>
  </div>
</nav>
${body}
</body></html>`;
  res.send(html);
});

// ── Agenda API endpoints ──────────────────────────────────────────────

// GET /dashboard/api/agenda?from=&to=  → full data for the interactive view
router.get('/dashboard/api/agenda', async (req, res) => {
  const from = req.query.from || today();
  const to = req.query.to || today();
  const [appts, blocks] = await Promise.all([
    appointmentsRepo.findRange(from, to),
    blocksRepo.list(from, to),
  ]);

  // Derive hours from businessConfig
  const allTimes = business.horarios
    .map(h => h.horario.match(/(\d{2}):00/g))
    .filter(Boolean).flat().map(t => parseInt(t));
  const hStart = allTimes.length ? Math.min(...allTimes) : 8;
  const hEnd = allTimes.length ? Math.max(...allTimes) : 20;

  // Build services list from businessConfig
  const srvSet = [...new Set(business.servicios.map(s => s.nombre))];
  const services = srvSet.map(n => ({ n, c: '#818cf8' }));

  // Map DB rows to the format agendaView.html expects
  const appointments = appts.map(a => ({
    id: a.id,
    name: a.name,
    phone: a.phone,
    srv: a.service,
    date: a.appointment_date,
    from: a.from_min != null ? a.from_min : (parseInt(a.appointment_time) * 60 + parseInt((a.appointment_time || '0:0').split(':')[1] || 0)),
    dur: a.duration || 30,
    st: a.status || 'pendiente',
    color: a.color || null,
    pro: a.professional || 1,
    price: a.price || 0,
    deposit: a.deposit || 0,
    notes: a.notes || '',
  }));

  const blocksList = blocks.map(b => ({
    id: b.id,
    date: b.block_date,
    from: b.from_min,
    dur: b.duration,
    reason: b.reason || '',
  }));

  res.json({
    hours: { start: hStart, end: hEnd },
    professionals: [{ id: 1, name: business.nombreRecepcionista || 'Profesional', color: '#818cf8' }],
    services,
    appointments,
    blocks: blocksList,
  });
});

// POST /dashboard/api/appointment — create or update
router.post('/dashboard/api/appointment', express.json(), async (req, res) => {
  try {
    const b = req.body;
    // If only id+status → quick status change
    if (b.id && b.status && !b.name) {
      const pool = require('../db/pool');
      await pool.query('UPDATE appointments SET status=$1 WHERE id=$2', [b.status, b.id]);
      return res.json({ ok: true });
    }
    const timeStr = b.time || (b.from != null ? `${String(Math.floor(b.from / 60)).padStart(2, '0')}:${String(b.from % 60).padStart(2, '0')}` : '08:00');
    const saved = await appointmentsRepo.saveFull({
      id: b.id || null,
      name: b.name || '',
      phone: b.phone || '',
      service: b.srv || b.service || '',
      date: b.date,
      time: timeStr,
      from_min: b.from,
      duration: b.dur || b.duration || 30,
      status: b.status || 'pendiente',
      color: b.color || null,
      price: b.price || 0,
      deposit: b.deposit || 0,
      professional: b.pro || b.professional || 1,
      notes: b.notes || '',
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /dashboard/api/appointment/move — drag-drop
router.post('/dashboard/api/appointment/move', express.json(), async (req, res) => {
  try {
    const { id, date, from, duration } = req.body;
    const timeStr = `${String(Math.floor(from / 60)).padStart(2, '0')}:${String(from % 60).padStart(2, '0')}`;
    await appointmentsRepo.move(id, date, timeStr, from, duration);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /dashboard/api/block — create/update time block
router.post('/dashboard/api/block', express.json(), async (req, res) => {
  try {
    const { id, date, from, duration, reason } = req.body;
    if (id) {
      const updated = await blocksRepo.update(id, { from, duration, reason });
      return res.json(updated);
    }
    const created = await blocksRepo.create({ date, from, duration, reason });
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /dashboard/api/block/:id
router.delete('/dashboard/api/block/:id', async (req, res) => {
  try {
    await blocksRepo.remove(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
          (c) => {
            const displayName = c.nombre || c.phone;
            const initials = c.nombre ? c.nombre.trim().charAt(0).toUpperCase() : c.phone.slice(-2);
            const aiOff = c.ai_enabled === false ? ' ai-off' : '';
            return `
    <a class="conv-item${sel === c.phone ? ' sel' : ''}${aiOff}" href="${B}/dashboard/mensajes?phone=${encodeURIComponent(c.phone)}">
      <div class="avatar">${escapeHtml(initials)}</div>
      <div class="conv-meta">
        <div class="conv-phone">${escapeHtml(displayName)}${c.nombre ? '<span class="conv-num">' + escapeHtml(c.phone) + '</span>' : ''}</div>
        <div class="conv-last">${c.role === 'assistant' ? '🤖 ' : ''}${escapeHtml(c.content.slice(0, 60))}</div>
      </div>
      <div class="conv-time">${c.ai_enabled === false ? '<span class="ai-badge">HUMANO</span>' : ''} ${fmtTime(c.created_at)}</div>
    </a>`;
          }
        )
        .join('')
    : '<p class="empty">Todavía no hay conversaciones.</p>';
  const selConv = sel ? convs.find((c) => c.phone === sel) : null;
  const selName = selConv?.nombre || sel;
  const selAi = selConv ? selConv.ai_enabled !== false : true;
  const chatHtml =
    sel && chat
      ? `<div class="chat-head">
          <div class="chat-head-info">
            <strong>${escapeHtml(selName)}</strong>
            ${selConv?.nombre ? '<span class="chat-head-phone">' + escapeHtml(sel) + '</span>' : ''}
          </div>
          <label class="ai-toggle" title="${selAi ? 'IA activa — click para pasar a humano' : 'Modo humano — click para activar IA'}">
            <input type="checkbox" ${selAi ? 'checked' : ''} onchange="toggleAi('${sel}',this.checked)">
            <span class="ai-slider"></span>
            <span class="ai-label">${selAi ? '🤖 IA' : '👤 Humano'}</span>
          </label>
        </div>
    <div class="chat-msgs">${chat
      .map(
        (m) =>
          `<div class="bubble bubble-${m.role}">${escapeHtml(m.content)}<span class="t">${fmtTime(m.created_at)}</span></div>`
      )
      .join('')}</div>`
      : '<div class="chat-empty">Elegí una conversación para ver el chat</div>';
  const content = `<style>
.conv-num{font-size:.7rem;color:var(--mut);margin-left:6px;font-weight:400}
.ai-badge{font-size:.6rem;background:rgba(251,191,36,.2);color:var(--warn);padding:2px 6px;border-radius:6px;font-weight:600;margin-right:4px}
.conv-item.ai-off{opacity:.7;border-left:3px solid var(--warn)}
.chat-head{display:flex;justify-content:space-between;align-items:center}
.chat-head-info{display:flex;align-items:baseline;gap:8px}
.chat-head-phone{font-size:.75rem;color:var(--mut);font-weight:400}
.ai-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.ai-toggle input{display:none}
.ai-slider{width:42px;height:22px;background:var(--warn);border-radius:11px;position:relative;transition:background .25s}
.ai-slider::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .25s}
.ai-toggle input:checked+.ai-slider{background:var(--ok)}
.ai-toggle input:checked+.ai-slider::after{transform:translateX(20px)}
.ai-label{font-size:.78rem;font-weight:600;min-width:65px}
</style>
<h1>Mensajes</h1>
<p class="sub">Conversaciones del agente con tus clientes.</p>
<div class="chat-wrap">
  <div class="conv-list">
    <div class="conv-search"><input placeholder="Buscar por nombre o número..." oninput="for(const e of document.querySelectorAll('.conv-item'))e.style.display=e.textContent.includes(this.value)?'':'none'"></div>
    ${items}
  </div>
  <div class="chat-pane">${chatHtml}</div>
</div>
<script>
const m=document.querySelector('.chat-msgs');if(m)m.scrollTop=m.scrollHeight;
async function toggleAi(phone,enabled){
  try{
    await fetch('${B}/dashboard/api/toggle-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,enabled})});
    location.reload();
  }catch(e){alert('Error al cambiar modo')}
}
</script>`;
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
      <div><a class="btn" href="${B}/dashboard/mensajes?phone=${encodeURIComponent(h.phone)}">Ver conversación</a></div>
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
      return '<a class="lead-card lc-' + est + activo + '" href="' + B + '/dashboard/leads?estado=' + est + '">'
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
          + '<a class="btn lead-btn" href="' + B + '/dashboard/mensajes?phone=' + encodeURIComponent(l.phone) + '">Ver chat</a>'
          + '</div>';
      }).join('')
    : '<p class="empty" style="padding:32px;text-align:center">No hay leads en esta categoria.</p>';

  // Vista TABLERO (kanban)
  const columnas = Object.entries(ESTADO_INFO).map(([est, info]) => {
    const delEstado = leads.filter((l) => l.estado === est);
    const tarjetas = delEstado.length
      ? delEstado.map((l) =>
          '<a class="kan-card" href="' + B + '/dashboard/mensajes?phone=' + encodeURIComponent(l.phone) + '">'
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
    + '<a class="' + (vista === 'lista' ? 'tg-on' : '') + '" href="' + B + '/dashboard/leads">Lista</a>'
    + '<a class="' + (vista === 'tablero' ? 'tg-on' : '') + '" href="' + B + '/dashboard/leads?vista=tablero">Tablero</a>'
    + '</div>';

  const cuerpo = vista === 'tablero'
    ? '<div class="kanban">' + columnas + '</div>'
    : (filtro ? '<div class="toolbar"><a class="btn" href="' + B + '/dashboard/leads">Ver todos</a></div>' : '') + rows;

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

// ── API: Contactos bloqueados ──────────────────────────────────────────
const blockedContacts = require('../db/blockedContacts.repository');

router.post('/dashboard/api/block-contact', express.json(), async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{8,15}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Número inválido (solo dígitos, 8-15 chars)' });
  }
  await blockedContacts.add(phone.trim());
  res.json({ ok: true });
});

router.post('/dashboard/api/unblock-contact', express.json(), async (req, res) => {
  const { phone } = req.body;
  await blockedContacts.remove(phone);
  res.json({ ok: true });
});

router.get('/dashboard/ajustes', async (req, res) => {
  const online = await agentOnline();
  const horarios = business.horarios
    .map((h) => `${escapeHtml(h.dia)}: ${escapeHtml(h.horario)}`)
    .join('<br>');
  const listaBlocked = await blockedContacts.list();
  const bloqueados = listaBlocked.length
    ? listaBlocked.map((p) => `<div class="block-item"><span>${escapeHtml(p)}</span><button class="btn btn-sm btn-danger" onclick="unblock('${escapeHtml(p)}')">Quitar</button></div>`).join('')
    : '<p class="empty">No hay contactos bloqueados.</p>';

  const content = `<style>
.block-section{margin-top:28px;padding:20px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.block-section h3{margin-bottom:12px;font-size:.95rem}
.block-list{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.block-item{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--card2);border:1px solid var(--line);border-radius:10px;font-size:.88rem}
.block-add{display:flex;gap:8px}
.block-add input{flex:1;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card2);color:var(--txt);font-size:.88rem}
.btn-sm{padding:4px 12px;font-size:.78rem}
.btn-danger{background:rgba(248,113,113,.2);color:#f87171;border:1px solid rgba(248,113,113,.3)}
.btn-danger:hover{background:rgba(248,113,113,.35)}
</style>
<h1>Ajustes</h1>
<p class="sub">Configuración actual del agente.</p>
<dl class="kv">
  <dt>Negocio</dt><dd>${escapeHtml(business.nombre)}</dd>
  <dt>Recepcionista virtual</dt><dd>${escapeHtml(business.nombreRecepcionista)}</dd>
  <dt>Instagram</dt><dd>${escapeHtml(business.instagram)}</dd>
  <dt>WhatsApp humano</dt><dd>${escapeHtml(business.whatsappHumano)}</dd>
  <dt>Dirección</dt><dd>${escapeHtml(business.ubicacion.direccion)}, ${escapeHtml(business.ubicacion.ciudad)}</dd>
  <dt>Horarios</dt><dd>${horarios}</dd>
  <dt>Servicios cargados</dt><dd>${business.servicios.length}</dd>
  <dt>Usuario del panel</dt><dd>${escapeHtml(config.dashboardUser)}</dd>
</dl>
<div class="block-section">
  <h3>🚫 Contactos bloqueados (la IA no les responde)</h3>
  <div class="block-list">${bloqueados}</div>
  <div class="block-add">
    <input id="blockPhone" placeholder="Número con código país, ej: 5492235551234">
    <button class="btn" onclick="blockContact()">Agregar</button>
  </div>
</div>
<script>
async function blockContact(){
  const phone=document.getElementById('blockPhone').value.trim();
  if(!phone)return;
  try{
    await fetch('${B}/dashboard/api/block-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
    location.reload();
  }catch(e){alert('Error al bloquear')}
}
async function unblock(phone){
  if(!confirm('Desbloquear '+phone+'?'))return;
  try{
    await fetch('${B}/dashboard/api/unblock-contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
    location.reload();
  }catch(e){alert('Error al desbloquear')}
}
</script>`;
  res.send(renderPage({ active: 'ajustes', agentOnline: online, content }));
});

module.exports = router;
