const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');
const whatsappService = require('./whatsappService');

// ── Config ──────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 5 * 60 * 1000;  // cada 5 minutos
const ALERT_PHONE = '5492236747031';       // tu número para alertas
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;  // no repetir alerta por 30 min

let lastAlertAt = 0;
let wasDisconnected = false;

// ── Check connection state ──────────────────────────────────────────────
async function checkConnection() {
  try {
    const url = `${config.evolutionApiUrl}/instance/connectionState/${config.evolutionInstance}`;
    const res = await axios.get(url, {
      headers: { apikey: config.evolutionApiKey },
      timeout: 10000,
    });

    const state = res.data?.instance?.state;
    const now = Date.now();

    if (state !== 'open') {
      logger.warn(`[Monitor] WhatsApp desconectado — state: ${state}`);

      // Mandar alerta si no mandamos una hace poco
      if (now - lastAlertAt > ALERT_COOLDOWN_MS) {
        await sendAlert(state);
        lastAlertAt = now;
      }
      wasDisconnected = true;
    } else {
      // Si estaba desconectado y volvió, avisar que se reconectó
      if (wasDisconnected) {
        logger.info('[Monitor] WhatsApp reconectado ✓');
        wasDisconnected = false;
        // No mandamos mensaje de "reconectado" porque si WhatsApp está
        // recién conectado, mandar enseguida puede fallar
      }
      logger.info('[Monitor] WhatsApp conectado ✓');
    }
  } catch (err) {
    logger.error('[Monitor] Error chequeando conexión:', err.message);
  }
}

// ── Enviar alerta ───────────────────────────────────────────────────────
async function sendAlert(state) {
  try {
    const instance = config.evolutionInstance;
    const msg = `⚠️ *Alerta Wayudu*\n\nEl WhatsApp de *${instance}* se desconectó (state: ${state}).\n\nEntrá al VPS y reconectá escaneando el QR.`;
    await whatsappService.sendMessage(ALERT_PHONE, msg);
    logger.info(`[Monitor] Alerta enviada a ${ALERT_PHONE}`);
  } catch (err) {
    // Si WhatsApp está caído, no podemos mandar por WhatsApp.
    // Logueamos nomás.
    logger.error('[Monitor] No se pudo enviar alerta (WhatsApp caído):', err.message);
  }
}

// ── Start ───────────────────────────────────────────────────────────────
function start() {
  logger.info(`[Monitor] Monitoreo de conexión activo — check cada ${CHECK_INTERVAL_MS / 1000 / 60} min`);
  // Primer check a los 30 segundos de arrancar
  setTimeout(checkConnection, 30 * 1000);
  setInterval(checkConnection, CHECK_INTERVAL_MS);
}

module.exports = { start, checkConnection };
