const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');

// Envía un mensaje de texto por Evolution API con retry.
async function sendMessage(phone, text, retries = 2) {
  const url = `${config.evolutionApiUrl}/message/sendText/${config.evolutionInstance}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await axios.post(
        url,
        { number: phone, text },
        {
          headers: {
            apikey: config.evolutionApiKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      return true;
    } catch (err) {
      const status = err.response?.status;
      // Don't retry on 4xx (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        logger.error(`Error al enviar mensaje a ${phone} (${status}):`, err.response?.data || err.message);
        return false;
      }
      if (attempt < retries) {
        const delay = (attempt + 1) * 2000; // 2s, 4s
        logger.warn(`[WhatsApp] Retry ${attempt + 1}/${retries} para ${phone} en ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        logger.error(`Error al enviar mensaje a ${phone} tras ${retries + 1} intentos:`, err.response?.data || err.message);
        return false;
      }
    }
  }
  return false;
}

// Evolution API manda distintos formatos de evento (messages.upsert, etc).
// Devuelve { phone, text } o null si el evento no es un mensaje de texto entrante procesable.
function parseIncomingMessage(body) {
  const data = body?.data;
  if (!data) return null;

  // Ignorar mensajes enviados por el propio bot/número.
  if (data.key?.fromMe) return null;

  const remoteJid = data.key?.remoteJid;
  if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) return null; // ignora grupos, status, etc.

  const phone = remoteJid.replace('@s.whatsapp.net', '');

  const message = data.message;
  const text =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    null;

  const audioMsg = message?.audioMessage;
  if (audioMsg) {
    const mediaId = data.key?.id;
    return { phone, type: 'audio', mediaId, mimetype: audioMsg.mimetype || 'audio/ogg' };
  }

  if (!text) return null;

  return { phone, type: 'text', text: text.trim() };
}

async function downloadMedia(mediaId) {
  const url = `${config.evolutionApiUrl}/chat/getBase64FromMediaMessage/${config.evolutionInstance}`;
  try {
    const resp = await axios.post(
      url,
      { message: { key: { id: mediaId } } },
      {
        headers: {
          apikey: config.evolutionApiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    return resp.data?.base64 || null;
  } catch (err) {
    logger.error('Error descargando audio:', err.response?.data || err.message);
    return null;
  }
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

module.exports = { sendMessage, parseIncomingMessage, downloadMedia, transcribeAudio };
