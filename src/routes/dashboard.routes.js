const express = require('express');
const dashboardAuth = require('../middleware/dashboardAuth');
const appointmentsRepo = require('../db/appointments.repository');
const conversationsRepo = require('../db/conversations.repository');
const handoffsRepo = require('../db/handoffs.repository');
const leadsRepo = require('../db/leads.repository');
const business = require('../utils/businessConfig');
const config = require('../utils/config');
const { renderPage, escapeHtml } = require('../utils/dashboardLayout');
const { mondayOf, addDays } = require('../utils/weekCalendarView');
const agendaView = require('../utils/agendaView');
const blocksRepo = require('../db/blocks.repository');
const whatsappService = require('../services/whatsappService');

const router = express.Router();
const B = config.basePath; // e.g. '/simaxface' or ''
router.use('/dashboard', dashboardAuth);

// Helper: get nav badges for all pages
async function getNavBadges() {
  try {
    const d = await handoffsRepo.countRecent24h();
    const badges = {};
    if (d > 0) badges.derivaciones = d;
    return badges;
  } catch { return {}; }
}

// ── Send WhatsApp reply from dashboard ─────────────────────────────────
router.post('/dashboard/api/send-reply', express.json(), async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'phone and message required' });
  try {
    const sent = await whatsappService.sendMessage(phone, message.trim());
    if (sent) {
      // Save to conversations so it shows in chat
      const pool = require('../db/pool');
      await pool.query(
        'INSERT INTO conversations (phone, role, content) VALUES ($1, $2, $3)',
        [phone, 'assistant', `[HUMANO] ${message.trim()}`]
      );
    }
    res.json({ ok: sent });
  } catch (e) {
    res.status(500).json({ error: 'send failed' });
  }
});

// ── Global search ──────────────────────────────────────────────────────
router.get('/dashboard/api/search', async (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q || q.length < 2) return res.json({ leads: [], appointments: [], conversations: [] });
  try {
    const pool = require('../db/pool');
    const [leads, appts, convs] = await Promise.all([
      pool.query(`SELECT id, phone, nombre, status, created_at FROM leads WHERE LOWER(nombre) LIKE $1 OR phone LIKE $1 ORDER BY created_at DESC LIMIT 8`, [`%${q}%`]),
      pool.query(`SELECT id, name, phone, service, appointment_date, appointment_time, status FROM appointments WHERE LOWER(name) LIKE $1 OR phone LIKE $1 OR LOWER(service) LIKE $1 ORDER BY appointment_date DESC LIMIT 8`, [`%${q}%`]),
      pool.query(`SELECT DISTINCT ON (phone) phone, content, created_at FROM conversations WHERE phone LIKE $1 OR LOWER(content) LIKE $1 ORDER BY phone, created_at DESC LIMIT 8`, [`%${q}%`]),
    ]);
    res.json({ leads: leads.rows, appointments: appts.rows, conversations: convs.rows });
  } catch (e) {
    res.status(500).json({ error: 'search failed' });
  }
});

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
  return new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return fmtTime(d);
}

function fmtDay(d) {
  return new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit' });
}

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

const HOME_CSS = `<style>
  .hero { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:28px; }
  .hero .date { color:var(--mut); font-size:.9rem; text-transform:capitalize; }
  .st-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:28px; }
  .st { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px 18px; position:relative; overflow:hidden; text-decoration:none; color:inherit; transition:transform .16s, border-color .16s; display:block; }
  .st:hover { transform:translateY(-2px); border-color:var(--acc2); }
  .st::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3.5px; }
  .st .l { font-size:.7rem; color:var(--mut); text-transform:uppercase; letter-spacing:.07em; font-weight:650; }
  .st .v { font-size:1.7rem; font-weight:700; letter-spacing:-.03em; margin-top:4px; font-variant-numeric:tabular-nums; }
  .st .d { font-size:.72rem; color:var(--mut); margin-top:2px; }
  .st-acc::before { background:var(--acc); }
  .st-ok::before { background:var(--ok); }
  .st-warn::before { background:var(--warn); }
  .st-bad::before { background:var(--bad); }
  .st-info::before { background:#38bdf8; }
  .st-pink::before { background:#f472b6; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; }
  .panel h3 { font-size:.95rem; margin-bottom:10px; }
  .panel h3 a { float:right; font-size:.75rem; color:var(--acc2); text-decoration:none; font-weight:400; }
  .mini { display:flex; justify-content:space-between; gap:10px; padding:10px 0; border-bottom:1px solid var(--line); font-size:.85rem; }
  .mini:last-child { border-bottom:none; }
  .mini-sub { display:block; color:var(--mut); font-size:.75rem; margin-top:2px; }
  .mini-right { color:var(--mut); font-size:.78rem; white-space:nowrap; }
  @media (max-width:760px) { .cols { grid-template-columns:1fr; } .st-cards { grid-template-columns:repeat(2,1fr); gap:10px; } .st .v { font-size:1.4rem; } }
</style>`;

router.get('/dashboard', async (req, res) => {
  const t = today();
  const [online, turnosHoyAll, nuevos, derivs, derivs24h, proximos, convs, activity] = await Promise.all([
    agentOnline(),
    appointmentsRepo.findRange(t, t),
    conversationsRepo.countNewClientsToday(),
    handoffsRepo.countToday(),
    handoffsRepo.countRecent24h(),
    appointmentsRepo.findUpcoming(5),
    conversationsRepo.listConversations(),
    conversationsRepo.activityLast7Days(),
  ]);
  const confirmados = turnosHoyAll.filter(a => ['confirmado','curso','finalizado'].includes(a.status)).length;
  const cancelados = turnosHoyAll.filter(a => ['cancelado','noasistio'].includes(a.status)).length;
  const pendientes = turnosHoyAll.filter(a => a.status === 'pendiente').length;
  const ingresos = turnosHoyAll.filter(a => ['finalizado','curso','confirmado'].includes(a.status)).reduce((s, a) => s + (parseFloat(a.price) || 0), 0);
  const proCounts = {};
  turnosHoyAll.filter(a => a.status !== 'cancelado').forEach(a => { proCounts[a.professional || 1] = (proCounts[a.professional || 1] || 0) + 1; });
  const topPro = Object.keys(proCounts).sort((a, b) => proCounts[b] - proCounts[a])[0];
  const topProName = topPro ? (business.nombreRecepcionista || 'Profesional') : '—';
  const clientasNuevas = turnosHoyAll.filter(a => a.status !== 'cancelado').length; // approximate
  const stats = [
    ['st-acc', 'Turnos hoy', turnosHoyAll.length, `${pendientes} pendientes · ${confirmados} confirmados`, `${B}/dashboard/agenda`],
    ['st-ok', 'Confirmados', confirmados, 'listos para atender', `${B}/dashboard/agenda`],
    ['st-bad', 'Cancelados', cancelados, 'hoy', `${B}/dashboard/agenda`],
    ['st-info', 'Ingresos del día', '$' + ingresos.toLocaleString('es-AR'), 'estimado', `${B}/dashboard/agenda`],
    ['st-warn', 'Derivaciones', derivs, 'hoy', `${B}/dashboard/derivaciones`],
  ]
    .map(
      ([cls, lbl, num, sub, href]) =>
        `<a class="st ${cls}" href="${href}"><div class="l">${lbl}</div><div class="v">${num}</div><div class="d">${sub}</div></a>`
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
  const hoyLabel = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', day: 'numeric', month: 'long' });

  // Activity mini-chart (last 7 days)
  const maxAct = Math.max(...activity.map(a => a.n), 1);
  const actBars = activity.map(a => {
    const pct = Math.round((a.n / maxAct) * 100);
    const dayName = new Date(a.day + 'T12:00:00').toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'short' });
    return `<div class="act-col"><div class="act-bar-area"><div class="act-bar" style="height:${Math.max(pct, 5)}%"></div></div><div class="act-num">${a.n}</div><div class="act-day">${dayName}</div></div>`;
  }).join('');

  const content = `${HOME_CSS}
<style>
.act-wrap{display:flex;gap:8px;align-items:flex-end;height:120px;padding:12px 0 0}
.act-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.act-bar-area{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center;min-height:0}
.act-bar{width:100%;max-width:32px;background:linear-gradient(180deg,var(--acc),var(--acc2));border-radius:6px 6px 0 0;min-height:4px}
.act-num{font-size:.72rem;font-weight:700;color:var(--txt)}
.act-day{font-size:.66rem;color:var(--mut);text-transform:capitalize}
</style>
<div class="hero"><div><h1>Hola 👋</h1><p class="sub" style="margin-bottom:0">Así viene el día de ${escapeHtml(business.nombreRecepcionista)}.</p></div><div class="date">${hoyLabel}</div></div>
<div class="st-cards">${stats}</div>
<div class="cols">
  <div class="panel"><h3>Próximos turnos <a href="${B}/dashboard/agenda">Ver agenda →</a></h3>${turnosList}</div>
  <div class="panel"><h3>Conversaciones recientes <a href="${B}/dashboard/mensajes">Ver todas →</a></h3>${convsList}</div>
</div>
<div class="panel" style="margin-top:16px"><h3>📊 Actividad últimos 7 días <span style="font-weight:400;font-size:.75rem;color:var(--mut)">(mensajes)</span></h3><div class="act-wrap">${actBars}</div></div>
<script>setTimeout(()=>location.reload(),60000)</script>`;
  const badges = {};
  if (derivs24h > 0) badges.derivaciones = derivs24h;
  if (pendientes > 0) badges.agenda = pendientes;
  res.send(renderPage({ active: 'inicio', agentOnline: online, content, badges }));
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
    <a href="${B}/dashboard/estadisticas">Estadísticas</a>
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

  // Status → color mapping (matches ST object in agendaView.html)
  const STATUS_COLORS = {
    confirmado: '#34d399', pendiente: '#fbbf24', curso: '#38bdf8',
    finalizado: '#8b96ad', cancelado: '#f87171', noasistio: '#c084fc',
  };

  // Map DB rows to the format agendaView.html expects
  const appointments = appts.map(a => {
    const st = a.status || 'pendiente';
    return {
      id: a.id,
      name: a.name,
      phone: a.phone,
      srv: a.service,
      date: a.appointment_date,
      from: a.from_min != null ? a.from_min : (parseInt(a.appointment_time) * 60 + parseInt((a.appointment_time || '0:0').split(':')[1] || 0)),
      dur: a.duration || 30,
      st,
      color: a.color || STATUS_COLORS[st] || '#818cf8',
      pro: a.professional || 1,
      price: a.price || 0,
      deposit: a.deposit || 0,
      notes: a.notes || '',
    };
  });

  const blocksList = blocks.map(b => ({
    id: b.id,
    date: b.block_date,
    from: b.from_min,
    dur: b.duration,
    reason: b.reason || '',
  }));

  res.json({
    hours: { start: hStart, end: hEnd },
    professionals: (business.profesionales || [{ id: 1, nombre: business.nombreRecepcionista, color: '#818cf8' }]).map(p => ({ id: p.id, name: p.nombre, color: p.color })),
    services,
    appointments,
    blocks: blocksList,
  });
});

const VALID_STATUSES = ['pendiente', 'confirmado', 'curso', 'finalizado', 'cancelado', 'noasistio'];

// POST /dashboard/api/appointment — create or update
router.post('/dashboard/api/appointment', express.json(), async (req, res) => {
  try {
    const b = req.body;
    // Validate status if provided
    if (b.status && !VALID_STATUSES.includes(b.status)) {
      return res.status(400).json({ error: `Estado inválido: ${b.status}` });
    }
    // If only id+status → quick status change
    if (b.id && b.status && !b.name) {
      const pool = require('../db/pool');
      await pool.query('UPDATE appointments SET status=$1 WHERE id=$2', [b.status, b.id]);
      if (b.status === 'cancelado') fireWebhook('cancelled_appointment', { id: b.id, status: b.status });
      if (b.status === 'finalizado') fireWebhook('completed_appointment', { id: b.id, status: b.status });
      return res.json({ ok: true });
    }
    // Validate date format
    if (b.date && !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
      return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
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
    if (!b.id) fireWebhook('new_appointment', { name: b.name, phone: b.phone, service: b.srv, date: b.date, time: timeStr });
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
          <a class="chat-back" href="${B}/dashboard/mensajes">←</a>
          <div class="chat-head-info">
            <strong>${escapeHtml(selName)}</strong>
            ${selConv?.nombre ? '<span class="chat-head-phone">' + escapeHtml(sel) + '</span>' : ''}
          </div>
          <label class="ai-toggle" title="${selAi ? 'IA activa — click para pasar a humano' : 'Modo humano — click para activar IA'}">
            <input type="checkbox" ${selAi ? 'checked' : ''} onchange="toggleAi('${escapeHtml(sel).replace(/'/g, "\\'")}',this.checked)">
            <span class="ai-slider"></span>
            <span class="ai-label">${selAi ? '🤖 IA' : '👤 Humano'}</span>
          </label>
        </div>
    <div class="chat-msgs">${chat
      .filter((m) => !m.content.startsWith('[SISTEMA INTERNO'))
      .map(
        (m) => {
          const isHuman = m.content.startsWith('[HUMANO] ');
          const content = isHuman ? m.content.slice(9) : m.content;
          const cls = isHuman ? 'bubble-human' : `bubble-${m.role}`;
          const tag = isHuman ? '<span style="font-size:.65rem;opacity:.6;margin-right:4px">👤</span>' : '';
          return `<div class="bubble ${cls}">${tag}${escapeHtml(content)}<span class="t">${fmtTime(m.created_at)}</span></div>`;
        }
      )
      .join('')}</div>
    <div class="chat-input">
      <input type="text" id="replyMsg" placeholder="Escribí un mensaje…" autocomplete="off">
      <button id="sendBtn" title="Enviar">➤</button>
    </div>`
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
.chat-input{display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--line);background:var(--card2)}
.chat-input input{flex:1;padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--txt);font-size:.88rem;outline:none;transition:border .18s}
.chat-input input:focus{border-color:var(--acc2)}
.chat-input button{padding:10px 16px;border-radius:10px;background:var(--acc);color:#fff;border:none;font-size:1rem;cursor:pointer;font-weight:700;transition:all .18s}
.chat-input button:hover{background:var(--acc2);transform:scale(1.05)}
.chat-input button:disabled{opacity:.4;cursor:default;transform:none}
.bubble-human{align-self:flex-end;background:var(--warn);color:#1a1d26;border-bottom-right-radius:4px}
.chat-back{display:none;color:var(--acc2);text-decoration:none;font-size:1.3rem;font-weight:700;padding:0 8px 0 0}
@media(max-width:760px){
  .chat-wrap.has-sel .conv-list{display:none}
  .chat-wrap.has-sel .chat-pane{height:calc(100vh - 160px)}
  .chat-back{display:block}
  .chat-head{padding:10px 14px}
  .chat-head-info strong{font-size:.88rem}
  .ai-toggle{gap:4px}
  .ai-slider{width:36px;height:18px}
  .ai-slider::after{width:13px;height:13px;top:2.5px;left:2.5px}
  .ai-toggle input:checked+.ai-slider::after{transform:translateX(17px)}
  .ai-label{font-size:.7rem;min-width:auto}
}
</style>
<h1>Mensajes</h1>
<p class="sub">Conversaciones del agente con tus clientes.</p>
<div class="chat-wrap${sel ? ' has-sel' : ''}">
  <div class="conv-list">
    <div class="conv-search"><input placeholder="Buscar por nombre o número..." oninput="for(const e of document.querySelectorAll('.conv-item'))e.style.display=e.textContent.includes(this.value)?'':'none'"></div>
    ${items}
  </div>
  <div class="chat-pane">${chatHtml}</div>
</div>
<script>
const m=document.querySelector('.chat-msgs');if(m)m.scrollTop=m.scrollHeight;
// Send reply
var selPhone='${sel ? escapeHtml(sel).replace(/'/g, "\\'") : ''}';
var inp=document.getElementById('replyMsg'),btn=document.getElementById('sendBtn');
if(inp&&btn){
  async function sendReply(){
    var msg=inp.value.trim();if(!msg||!selPhone)return;
    btn.disabled=true;inp.disabled=true;
    try{
      var r=await fetch('${B}/dashboard/api/send-reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:selPhone,message:msg})});
      var d=await r.json();
      if(d.ok){
        var b=document.createElement('div');b.className='bubble bubble-assistant';b.innerHTML='<span style="font-size:.65rem;color:rgba(255,255,255,.6);margin-right:4px">👤</span>'+msg.replace(/</g,'&lt;')+'<span class="t">ahora</span>';
        m.appendChild(b);m.scrollTop=m.scrollHeight;inp.value='';
      }else{alert('No se pudo enviar')}
    }catch(e){alert('Error al enviar')}
    btn.disabled=false;inp.disabled=false;inp.focus();
  }
  btn.onclick=sendReply;
  inp.onkeydown=function(e){if(e.key==='Enter')sendReply()};
}
async function toggleAi(phone,enabled){
  try{
    await fetch('${B}/dashboard/api/toggle-ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,enabled})});
    location.reload();
  }catch(e){alert('Error al cambiar modo')}
}
// Notification sound for new messages
(function(){
  var lastCount=document.querySelectorAll('.conv-item').length;
  var audio=null;
  function beep(){
    if(!audio){var A=window.AudioContext||window.webkitAudioContext;if(!A)return;var ctx=new A();audio=ctx;};
    var ctx=audio;var o=ctx.createOscillator();var g=ctx.createGain();o.connect(g);g.connect(ctx.destination);
    o.type='sine';o.frequency.value=880;g.gain.value=0.15;o.start();g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);o.stop(ctx.currentTime+0.3);
  }
  setInterval(async function(){
    try{
      var r=await fetch('${B}/dashboard/api/stats');var d=await r.json();
      if(d.conversations>lastCount){beep();lastCount=d.conversations;
        document.title='💬 Nuevo mensaje — ${escapeHtml(business.nombre)}';
        setTimeout(function(){document.title='${escapeHtml(business.nombre)} - Panel'},4000);
      }
    }catch(e){}
  },15000);
})();
</script>`;
  const badges = await getNavBadges();
  res.send(renderPage({ active: 'mensajes', agentOnline: online, content, wide: true, badges }));
});

router.get('/dashboard/derivaciones', async (req, res) => {
  const [online, handoffs] = await Promise.all([agentOnline(), handoffsRepo.findRecent(50)]);
  const cards = handoffs.length
    ? handoffs
        .map(
          (h) => `
    <div class="hand-card">
      <div class="hand-info">
        <div class="hphone">${escapeHtml(h.nombre || h.phone)}${h.nombre ? '<span style="color:var(--mut);font-size:.75rem;margin-left:8px">' + escapeHtml(h.phone) + '</span>' : ''}</div>
        <div class="hdate">${timeAgo(h.created_at)}</div>
        <div class="hreason">${escapeHtml(h.reason)}</div>
      </div>
      <div><a class="btn" href="${B}/dashboard/mensajes?phone=${encodeURIComponent(h.phone)}">Ver chat</a></div>
    </div>`
        )
        .join('')
    : '<p class="empty">No hay derivaciones.</p>';
  const content = `<h1>Derivaciones</h1>
<p class="sub">Casos que el agente pasó a un humano.</p>
${cards}`;
  const badges = await getNavBadges();
  res.send(renderPage({ active: 'derivaciones', agentOnline: online, content, badges }));
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
          + '<div class="lead-when">' + timeAgo(l.ultimo_contacto) + '</div>'
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

  const totalLeads = Object.values(counts).reduce((s, n) => s + n, 0);
  const filtroLabel = vista === 'lista' && filtro && ESTADO_INFO[filtro] ? ' Mostrando: ' + ESTADO_INFO[filtro][1] : ` ${totalLeads} clientes en el CRM.`;

  const content = '<style>'
    + '.lead-search{margin-bottom:16px;display:flex;gap:8px}'
    + '.lead-search input{flex:1;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--txt);font-size:.88rem;outline:none}'
    + '.lead-search input:focus{border-color:var(--acc2)}'
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
    + (vista === 'lista' ? '<div class="lead-search"><input id="leadSearch" placeholder="Buscar por nombre, teléfono o interés..." oninput="filterLeads(this.value)"><a class="btn" href="' + B + '/dashboard/api/leads/export" title="Exportar CSV">📥 CSV</a></div>' : '')
    + cuerpo
    + '<script>function filterLeads(q){q=q.toLowerCase();document.querySelectorAll(".lead-row").forEach(r=>r.style.display=r.textContent.toLowerCase().includes(q)?"":"none")}</script>';
  const badges = await getNavBadges();
  res.send(renderPage({ active: 'leads', agentOnline: online, content, wide: true, badges }));
});

// ── API: CSV export ──────────────────────────────────────────────────
router.get('/dashboard/api/leads/export', async (req, res) => {
  try {
    const leads = await leadsRepo.listLeads(null);
    const header = 'Teléfono,Nombre,Estado,Interés,Último contacto\n';
    const rows = leads.map(l =>
      [l.phone, l.nombre || '', l.estado, l.interes || '', l.ultimo_contacto ? new Date(l.ultimo_contacto).toISOString() : '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=leads_${today()}.csv`);
    res.send('﻿' + header + rows); // BOM for Excel UTF-8
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard/api/appointments/export', async (req, res) => {
  try {
    const from = req.query.from || today();
    const to = req.query.to || today();
    const appts = await appointmentsRepo.findRange(from, to);
    const header = 'ID,Nombre,Teléfono,Servicio,Fecha,Hora,Estado,Duración,Precio\n';
    const rows = appts.map(a =>
      [a.id, a.name, a.phone, a.service, a.appointment_date, (a.appointment_time || '').slice(0, 5), a.status, a.duration, a.price]
        .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=turnos_${from}_${to}.csv`);
    res.send('﻿' + header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Estadísticas mensuales ─────────────────────────────────────────────
router.get('/dashboard/estadisticas', async (req, res) => {
  const online = await agentOnline();
  const pool = require('../db/pool');

  // Get stats for the current month and last month
  const [monthlyAppts, monthlyConvs, monthlyLeads, topServices] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('confirmado','curso','finalizado'))::int AS atendidos,
        COUNT(*) FILTER (WHERE status = 'cancelado')::int AS cancelados,
        COUNT(*) FILTER (WHERE status = 'noasistio')::int AS noasistio,
        COALESCE(SUM(price) FILTER (WHERE status IN ('confirmado','curso','finalizado')), 0)::numeric AS ingresos
      FROM appointments
      WHERE appointment_date >= date_trunc('month', CURRENT_DATE)
    `),
    pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(DISTINCT phone)::int AS clientes_unicos
      FROM conversations
      WHERE created_at >= date_trunc('month', CURRENT_DATE)
    `),
    pool.query(`
      SELECT estado, COUNT(*)::int AS n
      FROM leads
      GROUP BY estado
    `),
    pool.query(`
      SELECT service, COUNT(*)::int AS n
      FROM appointments
      WHERE appointment_date >= date_trunc('month', CURRENT_DATE) AND status != 'cancelado'
      GROUP BY service ORDER BY n DESC LIMIT 8
    `),
  ]);

  const ma = monthlyAppts.rows[0];
  const mc = monthlyConvs.rows[0];
  const mesLabel = new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', month: 'long', year: 'numeric' });

  // Top services mini-chart
  const maxSvc = Math.max(...topServices.rows.map(s => s.n), 1);
  const svcBars = topServices.rows.map(s => {
    const pct = Math.round((s.n / maxSvc) * 100);
    return `<div class="svc-bar-row"><span class="svc-bar-name">${escapeHtml(s.service)}</span><div class="svc-bar-track"><div class="svc-bar-fill" style="width:${pct}%"></div></div><span class="svc-bar-num">${s.n}</span></div>`;
  }).join('') || '<p class="empty">Sin turnos este mes.</p>';

  // Lead funnel
  const leadStates = {};
  monthlyLeads.rows.forEach(r => { leadStates[r.estado] = r.n; });
  const funnelOrder = ['nuevo', 'consultando', 'turno', 'cliente', 'frio'];
  const totalLeads = funnelOrder.reduce((s, e) => s + (leadStates[e] || 0), 0) || 1;
  const funnel = funnelOrder.map(e => {
    const n = leadStates[e] || 0;
    const pct = Math.round((n / totalLeads) * 100);
    const info = { nuevo: '🆕', consultando: '👀', turno: '📅', cliente: '⭐', frio: '❄️' };
    return `<div class="fun-row"><span class="fun-ico">${info[e]}</span><span class="fun-lbl">${e}</span><div class="fun-track"><div class="fun-fill fun-${e}" style="width:${pct}%"></div></div><span class="fun-num">${n}</span></div>`;
  }).join('');

  const tasaCancel = ma.total ? Math.round((ma.cancelados / ma.total) * 100) : 0;
  const tasaNoShow = ma.total ? Math.round((ma.noasistio / ma.total) * 100) : 0;

  const content = `<style>
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px}
.stat-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;text-align:center}
.stat-card .sc-v{font-size:2rem;font-weight:700;letter-spacing:-.03em}
.stat-card .sc-l{font-size:.75rem;color:var(--mut);margin-top:4px}
.stat-card.sc-green .sc-v{color:var(--ok)}.stat-card.sc-red .sc-v{color:var(--bad)}.stat-card.sc-blue .sc-v{color:#38bdf8}.stat-card.sc-purple .sc-v{color:var(--acc2)}
.stat-panels{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.stat-panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px}
.stat-panel h3{font-size:.9rem;margin-bottom:14px}
.svc-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:.82rem}
.svc-bar-name{width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
.svc-bar-track{flex:1;height:12px;background:var(--card2);border-radius:6px;overflow:hidden}
.svc-bar-fill{height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:6px}
.svc-bar-num{width:30px;text-align:right;font-weight:600;flex-shrink:0}
.fun-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:.82rem}
.fun-ico{font-size:1rem;width:24px;text-align:center;flex-shrink:0}
.fun-lbl{width:90px;text-transform:capitalize;flex-shrink:0}
.fun-track{flex:1;height:14px;background:var(--card2);border-radius:7px;overflow:hidden}
.fun-fill{height:100%;border-radius:7px}
.fun-nuevo{background:#94a3b8}.fun-consultando{background:var(--warn)}.fun-turno{background:var(--acc2)}.fun-cliente{background:var(--ok)}.fun-frio{background:#60a5fa}
.fun-num{width:30px;text-align:right;font-weight:600;flex-shrink:0}
@media(max-width:760px){.stat-panels{grid-template-columns:1fr}.svc-bar-name{width:100px}}
</style>
<h1>Estadísticas</h1>
<p class="sub" style="text-transform:capitalize">${mesLabel}</p>
<div class="stat-grid">
  <div class="stat-card sc-blue"><div class="sc-v">${ma.total}</div><div class="sc-l">Turnos del mes</div></div>
  <div class="stat-card sc-green"><div class="sc-v">${ma.atendidos}</div><div class="sc-l">Atendidos</div></div>
  <div class="stat-card sc-green"><div class="sc-v">$${Number(ma.ingresos).toLocaleString('es-AR')}</div><div class="sc-l">Ingresos del mes</div></div>
  <div class="stat-card sc-purple"><div class="sc-v">${mc.clientes_unicos}</div><div class="sc-l">Clientes únicos</div></div>
  <div class="stat-card"><div class="sc-v">${mc.total}</div><div class="sc-l">Mensajes del mes</div></div>
  <div class="stat-card sc-red"><div class="sc-v">${tasaCancel}%</div><div class="sc-l">Tasa cancelación</div></div>
</div>
<div class="stat-panels">
  <div class="stat-panel"><h3>🏆 Servicios más pedidos</h3>${svcBars}</div>
  <div class="stat-panel"><h3>📊 Funnel de leads (total)</h3>${funnel}</div>
</div>`;
  const badges = await getNavBadges();
  res.send(renderPage({ active: 'estadisticas', agentOnline: online, content, wide: true, badges }));
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

  // Build services grouped by category
  const svcByCategory = {};
  business.servicios.forEach(s => {
    if (!svcByCategory[s.categoria]) svcByCategory[s.categoria] = [];
    svcByCategory[s.categoria].push(s);
  });
  const svcHtml = Object.entries(svcByCategory).map(([cat, svcs]) =>
    `<div class="svc-cat"><h4>${escapeHtml(cat)} <span class="svc-count">${svcs.length}</span></h4>`
    + svcs.map(s => `<div class="svc-row"><span class="svc-name">${escapeHtml(s.nombre)}</span><span class="svc-dur">${s.duracionMinutos}min</span><span class="svc-price">${s.precio ? '$' + s.precio.toLocaleString('es-AR') : 'Gratis'}</span></div>`).join('')
    + '</div>'
  ).join('');

  // Promotions with expiry check
  const todayStr = today();
  const promoHtml = business.promociones.length
    ? business.promociones.map(p => {
        const expired = p.vigenteHasta && p.vigenteHasta < todayStr;
        return `<div class="promo-item${expired ? ' promo-expired' : ''}"><strong>${escapeHtml(p.nombre)}</strong> — ${escapeHtml(p.descripcion)} <span class="promo-date">${expired ? '⚠️ Vencida' : 'Hasta ' + p.vigenteHasta}</span></div>`;
      }).join('')
    : '<p class="empty">Sin promociones configuradas.</p>';

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
.svc-cat{margin-bottom:16px}
.svc-cat h4{font-size:.85rem;color:var(--acc2);margin-bottom:8px;display:flex;align-items:center;gap:8px}
.svc-count{font-size:.7rem;background:var(--card2);border-radius:999px;padding:1px 8px;color:var(--mut)}
.svc-row{display:flex;gap:12px;padding:8px 14px;border-bottom:1px solid var(--line);font-size:.82rem}
.svc-row:last-child{border-bottom:none}
.svc-name{flex:1;font-weight:500}.svc-dur{color:var(--mut);width:60px;text-align:right}.svc-price{font-weight:600;width:90px;text-align:right;color:var(--ok)}
.promo-item{padding:12px 14px;background:var(--card2);border:1px solid var(--line);border-radius:10px;margin-bottom:8px;font-size:.85rem}
.promo-expired{opacity:.6;border-color:var(--bad)}
.promo-date{font-size:.72rem;color:var(--mut);margin-left:8px}
.promo-expired .promo-date{color:var(--bad)}
.sys-info{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.sys-badge{padding:8px 14px;background:var(--card2);border-radius:8px;font-size:.78rem;display:flex;justify-content:space-between}
.sys-badge .sys-v{color:var(--ok);font-weight:600}
@media(max-width:640px){.sys-info{grid-template-columns:1fr}.svc-row{flex-wrap:wrap;gap:4px}}
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
  <dt>Modelo IA</dt><dd>${escapeHtml(config.claudeModel)}</dd>
  <dt>Audio (Groq)</dt><dd>${config.groqApiKey ? '✅ Configurado' : '❌ No configurado'}</dd>
</dl>
<div class="block-section">
  <h3>📋 Servicios y precios (${business.servicios.length})</h3>
  ${svcHtml}
</div>
<div class="block-section">
  <h3>🎁 Promociones</h3>
  ${promoHtml}
</div>
<div class="block-section">
  <h3>🔗 Webhook externo (n8n / Zapier / Make)</h3>
  <p style="font-size:.82rem;color:var(--mut);margin-bottom:10px">Recibí notificaciones automáticas cuando se crean, cancelan o completan turnos. Configurá <code>WEBHOOK_EXTERNAL_URL</code> en tu <code>.env</code>.</p>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <span style="font-size:.82rem;font-weight:600">${config.webhookExternalUrl ? '✅ ' + escapeHtml(config.webhookExternalUrl) : '❌ No configurado'}</span>
    ${config.webhookExternalUrl ? '<button class="btn btn-sm" onclick="testWebhook()">🧪 Probar</button>' : ''}
  </div>
  <p style="font-size:.72rem;color:var(--mut);margin-top:8px">Eventos: <code>new_appointment</code>, <code>cancelled_appointment</code>, <code>completed_appointment</code>, <code>test</code></p>
</div>
<div class="block-section">
  <h3>🚫 Contactos bloqueados (la IA no les responde)</h3>
  <div class="block-list">${bloqueados}</div>
  <div class="block-add">
    <input id="blockPhone" placeholder="Número con código país, ej: 5492235551234">
    <button class="btn" onclick="blockContact()">Agregar</button>
  </div>
</div>
<script>
async function testWebhook(){
  try{
    var r=await fetch('${B}/dashboard/api/webhook/test',{method:'POST',headers:{'Content-Type':'application/json'}});
    var d=await r.json();
    alert(d.ok?'✅ Webhook enviado correctamente':'❌ Error: '+(d.error||'desconocido'));
  }catch(e){alert('Error: '+e.message)}
}
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
  const badges = await getNavBadges();
  res.send(renderPage({ active: 'ajustes', agentOnline: online, content, badges }));
});

// ── API: System stats ───────────────────────────────────────────────────
router.get('/dashboard/api/stats', async (req, res) => {
  try {
    const pool = require('../db/pool');
    const [convCount, leadCount, apptCount] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM conversations'),
      pool.query('SELECT COUNT(*)::int AS n FROM leads'),
      pool.query('SELECT COUNT(*)::int AS n FROM appointments'),
    ]);
    res.json({
      conversations: convCount.rows[0].n,
      leads: leadCount.rows[0].n,
      appointments: apptCount.rows[0].n,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().rss / 1048576),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook for external integrations (n8n / Zapier / Make) ────────────
// Events: new_appointment, cancelled_appointment, new_lead, new_handoff
// Config: set WEBHOOK_EXTERNAL_URL in .env to enable
router.post('/dashboard/api/webhook/test', express.json(), async (req, res) => {
  const url = config.webhookExternalUrl;
  if (!url) return res.status(400).json({ error: 'WEBHOOK_EXTERNAL_URL not configured in .env' });
  try {
    const axios = require('axios');
    await axios.post(url, { event: 'test', timestamp: new Date().toISOString(), business: business.nombre }, { timeout: 5000 });
    res.json({ ok: true, url });
  } catch (e) {
    res.status(500).json({ error: 'Could not reach webhook URL: ' + e.message });
  }
});

// Called internally when events happen — not an HTTP route, just a helper
async function fireWebhook(event, data) {
  const url = config.webhookExternalUrl;
  if (!url) return;
  try {
    const axios = require('axios');
    await axios.post(url, { event, timestamp: new Date().toISOString(), business: business.nombre, data }, { timeout: 5000 });
  } catch (e) {
    require('../utils/logger').warn('[Webhook] Failed to fire ' + event + ': ' + e.message);
  }
}

module.exports = router;
module.exports.fireWebhook = fireWebhook;
