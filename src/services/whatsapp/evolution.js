const axios = require('axios');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

// Proveedor no oficial (Evolution API / Baileys). Se escanea un QR y usa un WhatsApp común.

function headers() {
  return { apikey: config.evolutionApiKey, 'Content-Type': 'application/json' };
}

async function sendText(phone, text) {
  const url = `${config.evolutionApiUrl}/message/sendText/${config.evolutionInstance}`;
  await axios.post(url, { number: phone, text }, { headers: headers(), timeout: 15000 });
}

// Evolution no tiene plantillas ni ventana de 24hs.
async function sendTemplate() {
  throw new Error('Evolution API no soporta plantillas');
}

// Devuelve una lista de mensajes normalizados: { id, phone, timestamp, type, text | mediaId, mimetype }
function parseIncoming(body) {
  const data = body?.data;
  if (!data) return [];

  // Ignorar mensajes enviados por el propio bot/número.
  if (data.key?.fromMe) return [];

  const remoteJid = data.key?.remoteJid;
  if (!remoteJid || !remoteJid.endsWith('@s.whatsapp.net')) return []; // ignora grupos, status, etc.

  const base = {
    id: data.key?.id || null,
    phone: remoteJid.replace('@s.whatsapp.net', ''),
    timestamp: data.messageTimestamp ? Number(data.messageTimestamp) : null,
  };

  const message = data.message;
  const audioMsg = message?.audioMessage;
  if (audioMsg) {
    return [{ ...base, type: 'audio', mediaId: base.id, mimetype: audioMsg.mimetype || 'audio/ogg' }];
  }

  const text =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    null;
  if (!text) return [];

  return [{ ...base, type: 'text', text: text.trim() }];
}

async function downloadMedia(mediaId) {
  const url = `${config.evolutionApiUrl}/chat/getBase64FromMediaMessage/${config.evolutionInstance}`;
  try {
    const resp = await axios.post(url, { message: { key: { id: mediaId } } }, { headers: headers(), timeout: 30000 });
    return resp.data?.base64 || null;
  } catch (err) {
    logger.error('Error descargando audio:', err.response?.data || err.message);
    return null;
  }
}

// 'open' si está conectado; cualquier otro valor es un problema.
async function getConnectionState() {
  const url = `${config.evolutionApiUrl}/instance/connectionState/${config.evolutionInstance}`;
  const res = await axios.get(url, { headers: { apikey: config.evolutionApiKey }, timeout: 10000 });
  return res.data?.instance?.state || 'desconocido';
}

module.exports = { sendText, sendTemplate, parseIncoming, downloadMedia, getConnectionState };
