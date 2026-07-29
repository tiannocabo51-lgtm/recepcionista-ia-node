const express = require('express');
const config = require('../utils/config');
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsappService');
const claudeService = require('../services/claudeService');
const leadsRepo = require('../db/leads.repository');

const router = express.Router();

function isAuthorized(req) {
  if (!config.webhookVerifyToken) return true; // sin token configurado, no se valida
  return req.query.token === config.webhookVerifyToken;
}

async function processIncoming(phone, text, audioData) {
  try {
    const reply = await claudeService.handleMessage(phone, text, audioData);
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
    processIncoming(parsed.phone, null, { base64, mimetype: parsed.mimetype });
    return;
  }

  logger.info(`Mensaje entrante de ${parsed.phone}: ${parsed.text.slice(0, 80)}`);
  processIncoming(parsed.phone, parsed.text);
});

module.exports = router;
