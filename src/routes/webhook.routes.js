const express = require('express');
const config = require('../utils/config');
const logger = require('../utils/logger');
const whatsappService = require('../services/whatsappService');
const claudeService = require('../services/claudeService');

const router = express.Router();

function isAuthorized(req) {
  if (!config.webhookVerifyToken) return true; // sin token configurado, no se valida
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

router.post('/webhook', (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ status: 'unauthorized' });
  }

  const parsed = whatsappService.parseIncomingMessage(req.body);

  // Siempre respondemos 200 rápido para que Evolution API no reintente el webhook.
  res.status(200).json({ status: 'received' });

  if (!parsed) return;

  logger.info(`Mensaje entrante de ${parsed.phone}: ${parsed.text.slice(0, 80)}`);
  processIncoming(parsed.phone, parsed.text);
});

module.exports = router;
