const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');
const business = require('../utils/businessConfig');
const windowRepo = require('../db/whatsappWindow.repository');

const provider = require('./whatsapp/cloud');

// Margen para no mandar justo cuando se está cerrando la ventana de 24hs.
const WINDOW_MS = 23.5 * 60 * 60 * 1000;

async function withRetry(label, fn, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fn();
      return true;
    } catch (err) {
      const status = err.response?.status;
      // Don't retry on 4xx (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        logger.error(`Error al enviar ${label} (${status}):`, JSON.stringify(err.response?.data) || err.message);
        return false;
      }
      if (attempt < retries) {
        const delay = (attempt + 1) * 2000; // 2s, 4s
        logger.warn(`[WhatsApp] Retry ${attempt + 1}/${retries} para ${label} en ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        logger.error(`Error al enviar ${label} tras ${retries + 1} intentos:`, err.response?.data || err.message);
        return false;
      }
    }
  }
  return false;
}

// WhatsApp solo deja mandar texto libre si la persona escribió en las últimas 24hs.
async function isWindowOpen(phone) {
  try {
    const last = await windowRepo.getLastInbound(phone);
    return !!last && Date.now() - new Date(last).getTime() < WINDOW_MS;
  } catch (err) {
    logger.error(`[WhatsApp] No se pudo leer la ventana de ${phone}:`, err.message);
    return false;
  }
}

async function recordInbound(phone) {
  await windowRepo.recordInbound(phone).catch((err) =>
    logger.error(`[WhatsApp] No se pudo guardar la ventana de ${phone}:`, err.message)
  );
}

async function sendTemplate(phone, name, params = []) {
  if (!name) return false;
  return withRetry(`plantilla "${name}" a ${phone}`, () => provider.sendTemplate(phone, name, params));
}

// Envía texto libre. Si pasaron más de 24hs desde el último mensaje de la persona,
// manda `options.fallbackTemplate` ({ name, params }) o no manda nada.
async function sendMessage(phone, text, options = {}) {
  if (await isWindowOpen(phone)) {
    return withRetry(`mensaje a ${phone}`, () => provider.sendText(phone, text));
  }

  const tpl = options.fallbackTemplate;
  if (tpl?.name) return sendTemplate(phone, tpl.name, tpl.params || []);

  logger.warn(`[WhatsApp] ${phone} no escribió en las últimas 24hs y no hay plantilla para este envío, no se manda`);
  return false;
}

// Avisos al dueño/recepcionista (derivaciones, turnos nuevos, alertas).
async function sendOwnerNotice(phone, text) {
  return sendMessage(phone, text, {
    fallbackTemplate: config.waTemplates.aviso && { name: config.waTemplates.aviso, params: [business.nombre, text] },
  });
}

function parseIncomingMessages(body) {
  return provider.parseIncoming(body);
}

async function downloadMedia(mediaId) {
  return provider.downloadMedia(mediaId);
}

async function getConnectionState() {
  return provider.getConnectionState();
}

async function transcribeAudio(base64Audio) {
  const apiKey = config.groqApiKey;
  if (!apiKey) {
    logger.error('GROQ_API_KEY no configurada, no se puede transcribir audio');
    return null;
  }
  try {
    const buffer = Buffer.from(base64Audio, 'base64');
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
    form.append('model', 'whisper-large-v3');
    form.append('language', 'es');

    const resp = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
      headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() },
      timeout: 30000,
    });
    return resp.data?.text || null;
  } catch (err) {
    logger.error('Error transcribiendo audio:', err.response?.data || err.message);
    return null;
  }
}

module.exports = {
  sendMessage,
  sendTemplate,
  sendOwnerNotice,
  isWindowOpen,
  recordInbound,
  parseIncomingMessages,
  downloadMedia,
  transcribeAudio,
  getConnectionState,
};
