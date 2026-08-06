const pool = require('../db/pool');
const logger = require('../utils/logger');
const whatsappService = require('./whatsappService');
const business = require('../../businessConfig');

const REMINDER_HOURS = 2; // Send reminder X hours before appointment
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // Check every 10 minutes

// Track which appointments already got a reminder (in-memory, resets on restart)
const sent = new Set();

async function checkAndSendReminders() {
  try {
    // Find appointments happening in the next REMINDER_HOURS that haven't been cancelled
    const result = await pool.query(`
      SELECT id, name, service, appointment_date::text, appointment_time, phone
      FROM appointments
      WHERE appointment_date = CURRENT_DATE
        AND status IN ('pendiente', 'confirmado')
        AND appointment_time BETWEEN
          (CURRENT_TIME + interval '${REMINDER_HOURS - 0.5} hours')
          AND (CURRENT_TIME + interval '${REMINDER_HOURS + 0.5} hours')
    `);

    for (const appt of result.rows) {
      if (sent.has(appt.id)) continue;
      sent.add(appt.id);

      const time = appt.appointment_time.slice(0, 5);
      const nombre = appt.name.split(' ')[0]; // First name only
      const msg = `Hola ${nombre} 👋\n\nTe recordamos tu turno de *${appt.service}* hoy a las *${time}* en ${business.nombre}.\n\n📍 ${business.ubicacion.direccion}\n\nSi necesitás cancelar o reprogramar, respondé a este mensaje. ¡Te esperamos!`;

      try {
        await whatsappService.sendMessage(appt.phone, msg);
        logger.info(`[Reminder] Enviado a ${appt.phone} para turno ${appt.id} a las ${time}`);
      } catch (err) {
        logger.error(`[Reminder] Error enviando a ${appt.phone}:`, err.message);
        sent.delete(appt.id); // Retry next cycle
      }

      // Small delay between messages to avoid antispam
      await new Promise(r => setTimeout(r, 3000));
    }
  } catch (err) {
    logger.error('[Reminder] Error checking reminders:', err.message);
  }
}

function start() {
  logger.info(`[Reminder] Servicio de recordatorios iniciado (${REMINDER_HOURS}h antes)`);
  // Initial delay 30s to let everything boot
  setTimeout(() => {
    checkAndSendReminders();
    setInterval(checkAndSendReminders, CHECK_INTERVAL_MS);
  }, 30000);
}

module.exports = { start };
