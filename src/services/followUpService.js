const logger = require('../utils/logger');
const pool = require('../db/pool');
const whatsappService = require('./whatsappService');
const claudeService = require('./claudeService');
const conversationsRepo = require('../db/conversations.repository');
const business = require('../utils/businessConfig');

// ── Config ──────────────────────────────────────────────────────────────
const MAX_FOLLOWUPS = 2;               // máximo 2 seguimientos por lead
const FIRST_FOLLOWUP_HOURS = 24;       // primer seguimiento a las 24hs
const SECOND_FOLLOWUP_HOURS = 72;      // segundo seguimiento a las 72hs
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada 1 hora
const HORARIO_INICIO = 9;             // no mandar antes de las 9
const HORARIO_FIN = 20;               // no mandar después de las 20

// ── Helpers ─────────────────────────────────────────────────────────────

function isBusinessHours() {
  const now = new Date();
  // Hora Argentina (UTC-3)
  const argHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })).getHours();
  const argDay = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })).getDay();
  // 0 = domingo, 6 = sábado
  if (argDay === 0) return false; // no mandar domingos
  return argHour >= HORARIO_INICIO && argHour < HORARIO_FIN;
}

// Busca leads que necesitan seguimiento
async function getStaleLeads() {
  const result = await pool.query(
    `SELECT l.phone, l.nombre, l.estado, l.interes, l.followup_count,
            l.ultimo_contacto, l.last_followup_at
     FROM leads l
     WHERE l.ai_enabled = true
       AND l.estado IN ('nuevo', 'consultando')
       AND l.followup_count < $1
       AND (
         (l.followup_count = 0 AND l.ultimo_contacto < now() - interval '${FIRST_FOLLOWUP_HOURS} hours')
         OR
         (l.followup_count = 1 AND l.last_followup_at < now() - interval '${SECOND_FOLLOWUP_HOURS} hours')
       )
     ORDER BY l.ultimo_contacto ASC
     LIMIT 10`,
    [MAX_FOLLOWUPS]
  );
  return result.rows;
}

// Genera un mensaje de seguimiento personalizado usando el historial
async function generateFollowUp(phone, lead) {
  try {
    const history = await conversationsRepo.findByPhone(phone, 15);
    if (!history.length) return null;

    const lastUserMsg = [...history].reverse().find((m) => m.role === 'user');
    const transcript = history
      .slice(-8) // últimos 8 mensajes para contexto
      .map((m) => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
      .join('\n');

    const isSecond = lead.followup_count === 1;

    const reply = await claudeService.handleMessage(
      phone,
      isSecond
        ? `[SISTEMA INTERNO - NO VISIBLE AL CLIENTE]: Han pasado 3 días desde el último contacto con este cliente. Generá un último mensaje de seguimiento breve y cálido. Si preguntó por algo específico, retomá eso. No seas insistente, simplemente recordale que estás disponible. Si no responde a este, no le vamos a volver a escribir.`
        : `[SISTEMA INTERNO - NO VISIBLE AL CLIENTE]: Han pasado 24hs sin respuesta de este cliente. Generá un mensaje de seguimiento corto y natural, como lo haría una recepcionista real. Si el cliente preguntó por un servicio o precio, retomá desde ahí. No digas "te escribo para hacer seguimiento" ni nada que suene a bot.`
    );

    return reply;
  } catch (err) {
    logger.error(`[Followup] Error generando mensaje para ${phone}:`, err.message);
    return null;
  }
}

// Marca el lead como seguido
async function markFollowUp(phone) {
  await pool.query(
    `UPDATE leads SET followup_count = followup_count + 1, last_followup_at = now() WHERE phone = $1`,
    [phone]
  );
}

// Resetea el contador cuando el lead responde (llamar desde el webhook)
async function resetFollowUp(phone) {
  await pool.query(
    `UPDATE leads SET followup_count = 0, last_followup_at = NULL WHERE phone = $1`,
    [phone]
  );
}

// ── Loop principal ──────────────────────────────────────────────────────

async function runFollowUps() {
  if (!isBusinessHours()) {
    logger.info('[Followup] Fuera de horario comercial, saltando');
    return;
  }

  try {
    const staleLeads = await getStaleLeads();
    if (!staleLeads.length) {
      logger.info('[Followup] Sin leads para seguimiento');
      return;
    }

    logger.info(`[Followup] ${staleLeads.length} leads para seguimiento`);

    for (const lead of staleLeads) {
      // Esperar entre mensajes para no triggerear antispam (30-60 seg)
      if (staleLeads.indexOf(lead) > 0) {
        const delay = 30000 + Math.random() * 30000;
        await new Promise((r) => setTimeout(r, delay));
      }

      const msg = await generateFollowUp(lead.phone, lead);
      if (!msg) continue;

      const sent = await whatsappService.sendMessage(lead.phone, msg);
      if (sent) {
        await markFollowUp(lead.phone);
        logger.info(`[Followup] Seguimiento #${lead.followup_count + 1} enviado a ${lead.phone}${lead.nombre ? ` (${lead.nombre})` : ''}`);

        // Notificar al dueño
        if (business.whatsappHumano) {
          whatsappService.sendMessage(
            business.whatsappHumano,
            `📋 Seguimiento automático #${lead.followup_count + 1} enviado a ${lead.nombre || lead.phone}${lead.interes ? ` (interés: ${lead.interes})` : ''}`
          ).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.error('[Followup] Error en ciclo de seguimiento:', err.message);
  }
}

// Inicia el loop
function start() {
  logger.info(`[Followup] Sistema de seguimiento activo — check cada ${CHECK_INTERVAL_MS / 60000} min`);
  // Primera ejecución a los 5 min de arrancar (dar tiempo a que todo levante)
  setTimeout(runFollowUps, 5 * 60 * 1000);
  setInterval(runFollowUps, CHECK_INTERVAL_MS);
}

module.exports = { start, runFollowUps, resetFollowUp, markFollowUp };
