const express = require('express');
const config = require('../utils/config');
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsappService');
const claudeService = require('../services/claudeService');
const leadsRepo = require('../db/leads.repository');
const followUpService = require('../services/followUpService');

const router = express.Router();

// Simple in-memory rate limiter per phone
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 messages per minute per phone

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

// Cleanup stale entries every 5 min
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

async function processIncoming(phone, text) {
  try {
    const reply = await claudeService.handleMessage(phone, text);
    await whatsappService.sendMessage(phone, reply);
  } catch (err) {
    logger.error(`Error procesando mensaje de ${phone}:`, err);
    await whatsappService
      .sendMessage(phone, 'Perdón, tuvimos un problema técnico. Ya te derivamos con la recepcionista.')
      .catch(() => {});
  }
}

router.post('/webhook', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ status: 'unauthorized' });
  }

  const parsed = whatsappService.parseIncomingMessage(req.body);

  res.status(200).json({ status: 'received' });

  if (!parsed) return;

  // Contactos bloqueados (personales del dueño) → ignorar
  const blockedContacts = require('../db/blockedContacts.repository');
  if (blockedContacts.isBlocked(parsed.phone)) {
    logger.info(`Contacto bloqueado ${parsed.phone}, ignorando`);
    return;
  }

  // Rate limit check
  if (isRateLimited(parsed.phone)) return;

  // Lead respondió → resetear contador de seguimientos
  followUpService.resetFollowUp(parsed.phone).catch(() => {});

  const lead = await leadsRepo.getLead(parsed.phone);
  if (lead && !lead.ai_enabled) {
    logger.info(`IA desactivada para ${parsed.phone}, ignorando mensaje`);
    return;
  }

  if (parsed.type === 'audio') {
    logger.info(`Audio entrante de ${parsed.phone}`);
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
    processIncoming(parsed.phone, transcription);
    return;
  }

  logger.info(`Mensaje entrante de ${parsed.phone}: ${parsed.text.slice(0, 80)}`);
  processIncoming(parsed.phone, parsed.text);
});

module.exports = router;
