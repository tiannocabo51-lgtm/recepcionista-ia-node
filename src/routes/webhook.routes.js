const express = require('express');
const config = require('../utils/config');
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsappService');
const claudeService = require('../services/claudeService');
const leadsRepo = require('../db/leads.repository');
const followUpService = require('../services/followUpService');
const lock = require('../services/conversationLock');

const router = express.Router();

// ── Rate limiter (por teléfono) ─────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(phone) {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(phone, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    logger.warn(`[RateLimit] ${phone} excedió ${RATE_LIMIT_MAX} msgs/min`);
    return true;
  }
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(phone);
  }
}, 300000);

function isAuthorized(req) {
  if (!config.webhookVerifyToken) return true;
  return req.query.token === config.webhookVerifyToken;
}

// ── Procesamiento de un mensaje entrante ────────────────────────────────
async function processIncoming(phone, text) {
  // Anti-loop: si ya respondimos demasiadas veces seguidas sin respuesta del user
  if (lock.isBurstLimited(phone)) {
    logger.warn(`[Webhook] Burst-limited para ${phone}, ignorando`);
    return;
  }

  try {
    const reply = await claudeService.handleMessage(phone, text);
    if (reply) {
      await whatsappService.sendMessage(phone, reply);
      lock.markBotReplied(phone);
    }
  } catch (err) {
    logger.error(`Error procesando mensaje de ${phone}:`, err);
    await whatsappService
      .sendMessage(phone, 'Perdón, tuvimos un problema técnico. Ya le aviso a la profesional.')
      .catch(() => {});
  }
}

// ── Webhook endpoint ────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ status: 'unauthorized' });
  }

  // Responder inmediatamente a Evolution API
  res.status(200).json({ status: 'received' });

  const body = req.body;
  const data = body?.data;
  if (!data) return;

  // ── DEDUPLICACIÓN: extraer messageId y rechazar duplicados ──────────
  const messageId = data.key?.id;
  if (lock.isDuplicate(messageId)) {
    logger.info(`[Dedup] Mensaje ${messageId} ya procesado, ignorando`);
    return;
  }

  // ── Ignorar mensajes antiguos (sync histórico al reconectar) ───────
  const messageTimestamp = data.messageTimestamp;
  if (messageTimestamp) {
    const msgAgeSeconds = Math.floor(Date.now() / 1000) - messageTimestamp;
    if (msgAgeSeconds > 120) { // más de 2 minutos de antigüedad
      logger.info(`[Dedup] Mensaje de ${msgAgeSeconds}s de antigüedad, ignorando (sync histórico)`);
      return;
    }
  }

  const parsed = whatsappService.parseIncomingMessage(body);
  if (!parsed) return;

  // ── Contactos bloqueados ───────────────────────────────────────────
  const blockedContacts = require('../db/blockedContacts.repository');
  if (blockedContacts.isBlocked(parsed.phone)) {
    logger.info(`Contacto bloqueado ${parsed.phone}, ignorando`);
    return;
  }

  // ── Rate limit ────────────────────────────────────────────────────
  if (isRateLimited(parsed.phone)) return;

  // ── Marcar que el usuario escribió (resetea burst counter) ────────
  lock.markUserMessage(parsed.phone);
  lock.resetBurst(parsed.phone);

  // ── Lead tracking ─────────────────────────────────────────────────
  followUpService.resetFollowUp(parsed.phone).catch(() => {});

  const lead = await leadsRepo.getLead(parsed.phone);
  if (lead && !lead.ai_enabled) {
    logger.info(`IA desactivada para ${parsed.phone}, ignorando mensaje`);
    return;
  }

  // ── Procesar con LOCK exclusivo por teléfono ──────────────────────
  // Solo un mensaje a la vez por número. Si llega otro mientras se procesa,
  // se encola (máx 1 — el último gana, el anterior se descarta).

  if (parsed.type === 'audio') {
    logger.info(`Audio entrante de ${parsed.phone}`);
    await lock.withLock(parsed.phone, async () => {
      const base64 = await whatsappService.downloadMedia(parsed.mediaId);
      if (!base64) {
        await whatsappService.sendMessage(parsed.phone, 'No pude escuchar tu audio, ¿me lo mandás de nuevo?');
        return;
      }
      const transcription = await whatsappService.transcribeAudio(base64);
      if (!transcription) {
        await whatsappService.sendMessage(parsed.phone, 'No pude entender tu audio, ¿me lo escribís por texto?');
        return;
      }
      logger.info(`Audio transcrito de ${parsed.phone}: ${transcription.slice(0, 80)}`);
      await processIncoming(parsed.phone, transcription);
    });
    return;
  }

  logger.info(`Mensaje entrante de ${parsed.phone}: ${parsed.text.slice(0, 80)}`);
  await lock.withLock(parsed.phone, () => processIncoming(parsed.phone, parsed.text));
});

module.exports = router;
