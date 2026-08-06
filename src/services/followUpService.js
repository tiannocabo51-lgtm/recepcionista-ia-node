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
         (l.followup_count = 0 AND l.ultimo_contacto < now() - $2 * interval '1 hour')
         OR
         (l.followup_count = 1 AND l.last_followup_at < now() - $3 * interval '1 hour')
       )
     ORDER BY l.ultimo_contacto ASC
     LIMIT 10`,
    [MAX_FOLLOWUPS, FIRST_FOLLOWUP_HOURS, SECOND_FOLLOWUP_HOURS]
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

// ── Confirmación de turnos ──────────────────────────────────────────────

// Busca turnos de mañana que todavía están en "pendiente"
async function getPendingAppointments() {
  const result = await pool.query(
    `SELECT a.id, a.name, a.phone, a.service,
            a.appointment_date::text AS appointment_date,
            a.appointment_time::text AS appointment_time,
            a.status
     FROM appointments a
     WHERE a.appointment_date = CURRENT_DATE + interval '1 day'
       AND a.status = 'pendiente'
       AND a.phone IS NOT NULL AND a.phone != ''
     ORDER BY a.appointment_time`
  );
  return result.rows;
}

// Genera mensaje de confirmación personalizado
async function generateConfirmation(appt) {
  try {
    const dayName = new Date(appt.appointment_date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long' });
    const time = appt.appointment_time.slice(0, 5);

    const reply = await claudeService.handleMessage(
      appt.phone,
      `[SISTEMA INTERNO - NO VISIBLE AL CLIENTE]: Mandá un mensaje corto y cálido para confirmar el turno de mañana. Datos: ${appt.name}, ${appt.service}, mañana ${dayName} a las ${time}hs. Preguntale si confirma. No digas "te escribo para confirmar tu turno" ni nada robótico, soná natural como una recepcionista que le recuerda. Si dice que sí, confirmalo. Si dice que no puede, ofrecé reprogramar.`
    );
    return reply;
  } catch (err) {
    logger.error(`[Followup] Error generando confirmación para ${appt.phone}:`, err.message);
    return null;
  }
}

// ── Loop principal ──────────────────────────────────────────────────────

async function runFollowUps() {
  if (!isBusinessHours()) {
    logger.info('[Followup] Fuera de horario comercial, saltando');
    return;
  }

  try {
    // 1. Seguimiento de leads fríos
    const staleLeads = await getStaleLeads();
    if (staleLeads.length) {
      logger.info(`[Followup] ${staleLeads.length} leads para seguimiento`);
    }

    for (const lead of staleLeads) {
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

        if (business.whatsappHumano) {
          whatsappService.sendMessage(
            business.whatsappHumano,
            `📋 Seguimiento automático #${lead.followup_count + 1} enviado a ${lead.nombre || lead.phone}${lead.interes ? ` (interés: ${lead.interes})` : ''}`
          ).catch(() => {});
        }
      }
    }

    // 2. Confirmación de turnos de mañana
    const pendingAppts = await getPendingAppointments();
    if (pendingAppts.length) {
      logger.info(`[Followup] ${pendingAppts.length} turnos pendientes para confirmar (mañana)`);
    }

    for (const appt of pendingAppts) {
      // Esperar entre mensajes
      const delay = 30000 + Math.random() * 30000;
      await new Promise((r) => setTimeout(r, delay));

      const msg = await generateConfirmation(appt);
      if (!msg) continue;

      const sent = await whatsappService.sendMessage(appt.phone, msg);
      if (sent) {
        logger.info(`[Followup] Confirmación enviada a ${appt.phone} (${appt.name}) — ${appt.service} mañana ${appt.appointment_time.slice(0, 5)}`);

        if (business.whatsappHumano) {
          whatsappService.sendMessage(
            business.whatsappHumano,
            `📅 Confirmación de turno enviada a ${appt.name} (${appt.phone}) — ${appt.service} mañana a las ${appt.appointment_time.slice(0, 5)}`
          ).catch(() => {});
        }
      }
    }

    if (!staleLeads.length && !pendingAppts.length) {
      logger.info('[Followup] Sin seguimientos ni confirmaciones pendientes');
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
