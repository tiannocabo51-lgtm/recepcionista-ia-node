const axios = require('axios');
const config = require('../utils/config');
const logger = require('../utils/logger');

// Envía un mensaje de texto por Evolution API.
async function sendMessage(phone, text) {
  const url = `${config.evolutionApiUrl}/message/sendText/${config.evolutionInstance}`;

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
    logger.error(`Error al enviar mensaje por WhatsApp a ${phone}:`, err.response?.data || err.message);
    return false;
  }
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

module.exports = { sendMessage, parseIncomingMessage, downloadMedia };
