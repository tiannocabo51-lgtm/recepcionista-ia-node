const axios = require('axios');
const config = require('../../utils/config');
const logger = require('../../utils/logger');

// Proveedor oficial: WhatsApp Cloud API de Meta.
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

function graphUrl(path) {
  return `https://graph.facebook.com/${config.waGraphVersion}/${path}`;
}

function authHeaders() {
  return { Authorization: `Bearer ${config.waAccessToken}`, 'Content-Type': 'application/json' };
}

async function sendText(phone, text) {
  await axios.post(
    graphUrl(`${config.waPhoneNumberId}/messages`),
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'text',
      text: { preview_url: false, body: text },
    },
    { headers: authHeaders(), timeout: 15000 }
  );
}

// Meta rechaza parámetros vacíos, con saltos de línea, tabs o más de 4 espacios seguidos.
function cleanParam(value) {
  const text = String(value ?? '')
    .replace(/\s*\n+\s*/g, ' · ')
    .replace(/\t/g, ' ')
    .replace(/ {4,}/g, '   ')
    .trim();
  return (text || '-').slice(0, 1000);
}

async function sendTemplate(phone, name, params = []) {
  const template = { name, language: { code: config.waTemplateLang } };
  if (params.length) {
    template.components = [
      { type: 'body', parameters: params.map((p) => ({ type: 'text', text: cleanParam(p) })) },
    ];
  }
  await axios.post(
    graphUrl(`${config.waPhoneNumberId}/messages`),
    { messaging_product: 'whatsapp', to: phone, type: 'template', template },
    { headers: authHeaders(), timeout: 15000 }
  );
}

function extractText(msg) {
  switch (msg.type) {
    case 'text': return msg.text?.body;
    case 'image': return msg.image?.caption;
    case 'video': return msg.video?.caption;
    case 'document': return msg.document?.caption;
    case 'button': return msg.button?.text; // botón de respuesta rápida de una plantilla
    case 'interactive':
      return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title;
    default: return null;
  }
}

// Un webhook de Meta puede traer varios mensajes; también trae "statuses" (entregado/leído) que se ignoran.
function parseIncoming(body) {
  if (body?.object !== 'whatsapp_business_account') return [];
  const out = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (value.metadata?.phone_number_id && value.metadata.phone_number_id !== config.waPhoneNumberId) {
        continue; // es de otro número de la misma cuenta
      }

      for (const status of value.statuses || []) {
        if (status.status === 'failed') {
          logger.error(`[WhatsApp] Falló el envío a ${status.recipient_id}:`, JSON.stringify(status.errors || []));
        }
      }

      for (const msg of value.messages || []) {
        const base = {
          id: msg.id,
          phone: msg.from,
          timestamp: msg.timestamp ? Number(msg.timestamp) : null,
        };

        if (msg.type === 'audio' && msg.audio?.id) {
          out.push({ ...base, type: 'audio', mediaId: msg.audio.id, mimetype: msg.audio.mime_type || 'audio/ogg' });
          continue;
        }

        const text = extractText(msg);
        if (text && text.trim()) out.push({ ...base, type: 'text', text: text.trim() });
      }
    }
  }
  return out;
}

async function downloadMedia(mediaId) {
  try {
    const meta = await axios.get(graphUrl(mediaId), { headers: authHeaders(), timeout: 15000 });
    const file = await axios.get(meta.data.url, {
      headers: { Authorization: `Bearer ${config.waAccessToken}` },
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    return Buffer.from(file.data).toString('base64');
  } catch (err) {
    logger.error('Error descargando audio:', err.response?.data || err.message);
    return null;
  }
}

// En la API oficial no hay QR ni "desconexión": lo que puede fallar es el token o el número.
async function getConnectionState() {
  try {
    await axios.get(graphUrl(config.waPhoneNumberId), {
      headers: authHeaders(),
      params: { fields: 'display_phone_number,quality_rating' },
      timeout: 10000,
    });
    return 'open';
  } catch (err) {
    const code = err.response?.data?.error?.code;
    if (code === 190) return 'token_invalido';
    if (err.response) return `error_${err.response.status}`;
    throw err;
  }
}

module.exports = { sendText, sendTemplate, parseIncoming, downloadMedia, getConnectionState };
