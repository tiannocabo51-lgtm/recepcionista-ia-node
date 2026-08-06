const business = require('./businessConfig');
const config = require('./config');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const B = config.basePath; // e.g. '/simaxface' or ''

const NAV = [
  ['inicio', 'Inicio', B + '/dashboard'],
  ['agenda', 'Agenda', B + '/dashboard/agenda'],
  ['mensajes', 'Mensajes', B + '/dashboard/mensajes'],
  ['leads', 'Leads', B + '/dashboard/leads'],
  ['estadisticas', 'Estadísticas', B + '/dashboard/estadisticas'],
  ['derivaciones', 'Derivaciones', B + '/dashboard/derivaciones'],
  ['ajustes', 'Ajustes', B + '/dashboard/ajustes'],
];

function renderPage({ active, agentOnline, content, wide, badges = {} }) {
  const navLinks = NAV.map(
    ([id, label, href]) => {
      const badge = badges[id] ? `<span class="nav-badge">${badges[id]}</span>` : '';
      return `<a class="nav-link${active === id ? ' active' : ''}" href="${href}">${label}${badge}</a>`;
    }
  ).join('');

  const status =
    agentOnline === true
      ? '<span class="dot dot-on"></span> En línea'
      : agentOnline === false
        ? '<span class="dot dot-off"></span> Desconectado'
        : '<span class="dot dot-unk"></span> Estado desconocido';

  const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light')</script>
<title>${escapeHtml(business.nombre)} - Panel</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  :root { --bg:#0b0f1a; --card:#121828; --card2:#171f33; --line:#232d47; --txt:#e6eaf2; --mut:#8b96ad; --acc:#6366f1; --acc2:#818cf8; --ok:#34d399; --warn:#fbbf24; --bad:#f87171; }
  :root.light { --bg:#f4f6fa; --card:#ffffff; --card2:#eef0f6; --line:#d8dce6; --txt:#1a1d26; --mut:#6b7280; --acc:#6366f1; --acc2:#4f46e5; --ok:#059669; --warn:#d97706; --bad:#dc2626; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--txt); min-height:100vh; transition:background .3s,color .3s; }
  header { position:sticky; top:0; z-index:50; display:flex; align-items:center; gap:20px; padding:14px 28px; background:rgba(11,15,26,.8); backdrop-filter:blur(12px); border-bottom:1px solid var(--line); transition:background .3s; }
  .light header { background:rgba(244,246,250,.85); }
  .brand { font-weight:700; font-size:1.05rem; letter-spacing:-.02em; }
  .status { font-size:.78rem; color:var(--mut); display:flex; align-items:center; gap:6px; }
  .dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
  .dot-on { background:var(--ok); box-shadow:0 0 8px var(--ok); }
  .dot-off { background:var(--bad); box-shadow:0 0 8px var(--bad); }
  .dot-unk { background:var(--mut); }
  .sync { font-size:.72rem; color:var(--mut); }
  nav { margin-left:auto; display:flex; gap:4px; }
  .nav-link { color:var(--mut); text-decoration:none; font-size:.88rem; padding:8px 14px; border-radius:8px; transition:all .18s; }
  .nav-link:hover { color:var(--txt); background:var(--card2); }
  .nav-link.active { color:#fff; background:var(--acc); }
  .nav-badge { background:var(--bad); color:#fff; font-size:.6rem; font-weight:700; padding:1px 6px; border-radius:999px; margin-left:6px; min-width:16px; text-align:center; }
  .theme-btn { width:34px; height:34px; border-radius:8px; border:1px solid var(--line); background:var(--card2); color:var(--mut); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .18s; font-size:1rem; flex-shrink:0; }
  .theme-btn:hover { border-color:var(--acc2); color:var(--txt); }
  .gsearch { position:relative; }
  .gsearch input { width:180px; padding:8px 12px 8px 32px; border-radius:8px; border:1px solid var(--line); background:var(--card2); color:var(--txt); font-size:.82rem; outline:none; transition:all .2s; }
  .gsearch input:focus { border-color:var(--acc2); width:260px; }
  .gsearch::before { content:'🔍'; position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:.7rem; }
  .gsearch-results { position:absolute; top:calc(100% + 6px); left:0; width:340px; max-height:400px; overflow-y:auto; background:var(--card); border:1px solid var(--line); border-radius:10px; box-shadow:0 16px 40px -14px rgba(0,0,0,.7); z-index:200; display:none; }
  .gsearch-results.on { display:block; }
  .gsr-section { padding:8px 12px 4px; font-size:.68rem; font-weight:700; color:var(--mut); text-transform:uppercase; letter-spacing:.06em; }
  .gsr-item { display:flex; align-items:center; gap:10px; padding:9px 12px; cursor:pointer; transition:background .12s; text-decoration:none; color:var(--txt); font-size:.84rem; }
  .gsr-item:hover { background:var(--card2); }
  .gsr-item .gi-icon { font-size:.9rem; flex-shrink:0; }
  .gsr-item .gi-name { font-weight:600; }
  .gsr-item .gi-sub { font-size:.72rem; color:var(--mut); }
  .gsr-empty { padding:16px; text-align:center; color:var(--mut); font-size:.82rem; }
  #menu-toggle, .hamburger { display:none; }
  main { max-width:${wide ? '1400px' : '1100px'}; margin:0 auto; padding:36px 28px 60px; }
  h1 { font-size:1.5rem; letter-spacing:-.02em; margin-bottom:6px; }
  .sub { color:var(--mut); font-size:.9rem; margin-bottom:32px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:22px; transition:transform .18s, border-color .18s; }
  .card:hover { transform:translateY(-2px); border-color:var(--acc2); }
  .card .ico { font-size:1.3rem; margin-bottom:10px; }
  .card .num { font-size:2rem; font-weight:700; letter-spacing:-.03em; }
  .card .lbl { color:var(--mut); font-size:.82rem; margin-top:4px; }
  .pill { display:inline-block; padding:3px 10px; border-radius:999px; font-size:.72rem; font-weight:600; }
  .pill-confirmado { background:rgba(52,211,153,.15); color:var(--ok); }
  .pill-pendiente { background:rgba(251,191,36,.15); color:var(--warn); }
  .pill-cancelado { background:rgba(248,113,113,.15); color:var(--bad); }
  .toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:10px; }
  .btn { display:inline-block; padding:8px 16px; border-radius:8px; background:var(--card2); border:1px solid var(--line); color:var(--txt); text-decoration:none; font-size:.84rem; transition:all .18s; }
  .btn:hover { border-color:var(--acc2); background:var(--card); }
  .cal-grid { display:grid; grid-template-columns:52px repeat(7,1fr); gap:1px; background:var(--line); border-radius:12px; overflow:hidden; border:1px solid var(--line); }
  .cal-cell { background:var(--bg); padding:4px; font-size:.72rem; color:var(--mut); }
  .cal-head { text-align:center; font-weight:600; color:var(--txt); padding:10px 4px; background:var(--card); }
  .cal-date { font-weight:400; color:var(--mut); }
  .cal-time-col { text-align:right; padding-right:6px; }
  .cal-slot { background:var(--card); opacity:.55; }
  .cal-closed { background:var(--bg); opacity:.35; }
  .cal-appt { background:linear-gradient(135deg,#312e81,#3730a3); color:#e0e7ff; border-radius:8px; padding:4px 7px; font-size:.7rem; overflow:hidden; margin:2px; border-left:3px solid var(--acc2); box-shadow:0 2px 8px rgba(0,0,0,.35); }
  .cal-appt.status-pendiente { background:linear-gradient(135deg,#422006,#713f12); border-left-color:var(--warn); }
  .cal-appt .cal-service { color:#a5b4fc; }
  .chat-wrap { display:grid; grid-template-columns:320px 1fr; gap:0; background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; height:70vh; }
  .conv-list { border-right:1px solid var(--line); overflow-y:auto; }
  .conv-search { padding:12px; border-bottom:1px solid var(--line); }
  .conv-search input { width:100%; padding:9px 12px; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--txt); font-size:.85rem; outline:none; }
  .conv-item { display:flex; gap:12px; padding:13px 14px; border-bottom:1px solid var(--line); text-decoration:none; color:var(--txt); transition:background .15s; }
  .conv-item:hover, .conv-item.sel { background:var(--card2); }
  .avatar { width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,var(--acc),var(--acc2)); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:.9rem; flex-shrink:0; }
  .conv-meta { min-width:0; flex:1; }
  .conv-phone { font-size:.86rem; font-weight:600; }
  .conv-last { font-size:.76rem; color:var(--mut); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:3px; }
  .conv-time { font-size:.68rem; color:var(--mut); flex-shrink:0; }
  .chat-pane { display:flex; flex-direction:column; overflow:hidden; }
  .chat-head { padding:14px 18px; border-bottom:1px solid var(--line); font-weight:600; font-size:.92rem; background:var(--card2); }
  .chat-msgs { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:10px; }
  .bubble { max-width:72%; padding:9px 13px; border-radius:14px; font-size:.86rem; line-height:1.45; }
  .bubble .t { display:block; font-size:.64rem; color:rgba(255,255,255,.5); margin-top:4px; }
  .bubble-user { align-self:flex-start; background:var(--card2); border-bottom-left-radius:4px; }
  .bubble-assistant { align-self:flex-end; background:var(--acc); color:#fff; border-bottom-right-radius:4px; }
  .chat-empty { flex:1; display:flex; align-items:center; justify-content:center; color:var(--mut); font-size:.9rem; }
  .hand-card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; margin-bottom:14px; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .hand-info .hphone { font-weight:600; font-size:.95rem; }
  .hand-info .hdate { color:var(--mut); font-size:.74rem; margin-top:2px; }
  .hand-info .hreason { margin-top:8px; font-size:.86rem; color:var(--txt); }
  .kv { display:grid; grid-template-columns:200px 1fr; gap:10px 20px; background:var(--card); border:1px solid var(--line); border-radius:14px; padding:24px; font-size:.88rem; }
  .kv dt { color:var(--mut); }
  .empty { color:var(--mut); font-style:italic; padding:20px; }
  @media (max-width:760px) {
    header { flex-wrap:wrap; padding:12px 16px; }
    .hamburger { display:block; margin-left:auto; font-size:1.4rem; cursor:pointer; color:var(--txt); }
    .gsearch { display:none; }
    nav { display:none; width:100%; flex-direction:column; margin:8px 0 0; }
    nav .nav-link { padding:12px 16px; font-size:.95rem; border-bottom:1px solid var(--line); }
    #menu-toggle:checked ~ nav { display:flex; }
    main { padding:16px 12px 40px; }
    h1 { font-size:1.25rem; }
    .sub { font-size:.82rem; margin-bottom:20px; }
    .cards { grid-template-columns:repeat(2,1fr); gap:10px; }
    .card { padding:16px; }
    .card .num { font-size:1.6rem; }
    .card .lbl { font-size:.74rem; }
    .chat-wrap { grid-template-columns:1fr; height:auto; }
    .conv-list { max-height:60vh; border-right:none; border-bottom:1px solid var(--line); overflow-y:auto; -webkit-overflow-scrolling:touch; }
    .conv-item { padding:14px 12px; }
    .avatar { width:38px; height:38px; font-size:.8rem; }
    .chat-pane { display:flex; flex-direction:column; }
    .chat-msgs { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; max-height:none; }
    .chat-head { flex-wrap:wrap; gap:6px; }
    .bubble { max-width:88%; font-size:.84rem; padding:10px 14px; }
    .hand-card { flex-direction:column; gap:10px; padding:14px; }
    .cal-cell { font-size:.6rem; }
    .kv { grid-template-columns:1fr; gap:8px 0; padding:16px; }
    .kv dt { font-weight:600; color:var(--acc2); }
    .toolbar { gap:8px; }
    .btn { font-size:.8rem; padding:7px 12px; }
  }

  /* Calendario v2 */
  .cal2 { border:1px solid var(--line); border-radius:14px; overflow:hidden; background:var(--card); margin-top:8px; }
  .cal2-head { display:grid; grid-template-columns:56px repeat(7,1fr); border-bottom:1px solid var(--line); }
  .cal2-corner { background:var(--card2); }
  .cal2-dayhead { padding:10px 6px; text-align:center; background:var(--card2); border-left:1px solid var(--line); display:flex; flex-direction:column; gap:2px; }
  .cal2-dayname { font-weight:700; font-size:.82rem; color:var(--txt); }
  .cal2-daynum { font-size:.7rem; color:var(--mut); }
  .cal2-today { background:rgba(99,102,241,.16); }
  .cal2-today .cal2-dayname { color:var(--acc2); }
  .cal2-body { display:grid; grid-template-columns:56px 1fr; }
  .cal2-timecol { display:flex; flex-direction:column; background:var(--card2); }
  .cal2-time { font-size:.68rem; color:var(--mut); text-align:right; padding:2px 8px 0 0; border-bottom:1px solid transparent; box-sizing:border-box; }
  .cal2-cols { display:grid; grid-template-columns:repeat(7,1fr); }
  .cal2-col { position:relative; border-left:1px solid var(--line); box-sizing:border-box; }
  .cal2-slot { box-sizing:border-box; border-bottom:1px solid rgba(35,45,71,.5); }
  .cal2-slot.cal2-onhour { border-bottom:1px solid var(--line); }
  .cal2-open { background:var(--card); }
  .cal2-closed { background:repeating-linear-gradient(45deg,var(--bg),var(--bg) 6px,#0d1220 6px,#0d1220 12px); }
  .cal2-appt { position:absolute; left:3px; right:3px; border-radius:8px; padding:4px 7px; box-sizing:border-box; overflow:hidden; display:flex; flex-direction:column; gap:1px; box-shadow:0 2px 8px rgba(0,0,0,.4); background:linear-gradient(135deg,#4338ca,#4f46e5); border-left:3px solid #a5b4fc; z-index:2; }
  .cal2-appt.st-pendiente { background:linear-gradient(135deg,#854d0e,#a16207); border-left-color:var(--warn); }
  .cal2-appt.st-cancelado { background:linear-gradient(135deg,#7f1d1d,#991b1b); border-left-color:var(--bad); opacity:.7; }
  .cal2-appt-line { display:flex; align-items:baseline; gap:5px; white-space:nowrap; overflow:hidden; }
  .cal2-appt-time { font-size:.66rem; font-weight:700; color:#fff; flex-shrink:0; }
  .cal2-appt-compact { padding:2px 7px; gap:0; }
  .cal2-appt-compact .cal2-appt-svc { display:none; }
  .cal2-appt-name { font-size:.74rem; font-weight:600; color:#eef2ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cal2-appt-svc { font-size:.66rem; color:#c7d2fe; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cal2-empty { color:var(--mut); font-style:italic; padding:24px; text-align:center; }
  @media (max-width:760px) { .cal2-body,.cal2-head { min-width:640px; } .cal2 { overflow-x:auto; } }
</style>
</head>
<body>
<header>
  <div>
    <div class="brand">${escapeHtml(business.nombre)}</div>
    <div class="status">${status} <span class="sync">· actualizado ${now}</span></div>
  </div>
  <div class="gsearch">
    <input id="gsInput" placeholder="Buscar cliente, turno…" autocomplete="off">
    <div class="gsearch-results" id="gsResults"></div>
  </div>
  <button class="theme-btn" id="themeBtn" title="Cambiar tema">🌙</button>
  <input type="checkbox" id="menu-toggle">
  <label for="menu-toggle" class="hamburger">☰</label>
  <nav>${navLinks}</nav>
</header>
<script>
(function(){
  var t=localStorage.getItem('theme');
  if(t==='light')document.documentElement.classList.add('light');
  var b=document.getElementById('themeBtn');
  function upd(){var l=document.documentElement.classList.contains('light');b.textContent=l?'☀️':'🌙';b.title=l?'Tema oscuro':'Tema claro'}
  upd();
  b.onclick=function(){document.documentElement.classList.toggle('light');localStorage.setItem('theme',document.documentElement.classList.contains('light')?'light':'dark');upd()};
})();
// Global search
(function(){
  var inp=document.getElementById('gsInput'),box=document.getElementById('gsResults'),timer=null,BP='${B}';
  if(!inp)return;
  inp.oninput=function(){clearTimeout(timer);var q=inp.value.trim();if(q.length<2){box.classList.remove('on');return}
    timer=setTimeout(async function(){
      try{var r=await fetch(BP+'/dashboard/api/search?q='+encodeURIComponent(q));var d=await r.json();var h='';
        if(d.leads.length){h+='<div class="gsr-section">Leads</div>';d.leads.forEach(function(l){h+='<a class="gsr-item" href="'+BP+'/dashboard/leads"><span class="gi-icon">👤</span><div><div class="gi-name">'+(l.nombre||l.phone)+'</div><div class="gi-sub">'+l.status+'</div></div></a>'})}
        if(d.appointments.length){h+='<div class="gsr-section">Turnos</div>';d.appointments.forEach(function(a){h+='<a class="gsr-item" href="'+BP+'/dashboard/agenda"><span class="gi-icon">📅</span><div><div class="gi-name">'+a.name+'</div><div class="gi-sub">'+a.service+' · '+a.appointment_date+'</div></div></a>'})}
        if(d.conversations.length){h+='<div class="gsr-section">Conversaciones</div>';d.conversations.forEach(function(c){h+='<a class="gsr-item" href="'+BP+'/dashboard/mensajes?phone='+encodeURIComponent(c.phone)+'"><span class="gi-icon">💬</span><div><div class="gi-name">'+c.phone+'</div><div class="gi-sub">'+c.content.slice(0,50)+'</div></div></a>'})}
        if(!h)h='<div class="gsr-empty">Sin resultados para "'+q+'"</div>';
        box.innerHTML=h;box.classList.add('on');
      }catch(e){}
    },300)};
  document.addEventListener('click',function(e){if(!e.target.closest('.gsearch'))box.classList.remove('on')});
  inp.onkeydown=function(e){if(e.key==='Escape'){box.classList.remove('on');inp.blur()}};
})();
</script>
<main>
${content}
</main>
</body>
</html>`;
}

module.exports = { renderPage, escapeHtml };
