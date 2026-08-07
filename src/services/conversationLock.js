const logger = require('../utils/logger');

// ── Deduplicación de mensajes (por messageId de Evolution API) ──────────
// Evita procesar el mismo webhook dos veces (reconexión, retry, sync histórico)
const processedMessages = new Map();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutos

function isDuplicate(messageId) {
  if (!messageId) return false;
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, Date.now());
  return false;
}

// ── Lock de procesamiento por teléfono ──────────────────────────────────
// Solo un mensaje a la vez por número. Si llega otro mientras se procesa, se encola.
// Máximo 1 en cola (el más reciente gana).
const phoneLocks = new Map();

/**
 * Ejecuta fn() con lock exclusivo por teléfono.
 * Si ya hay uno procesándose, encola (máx 1 — el último gana).
 * Retorna el resultado de fn() o null si se descartó.
 */
async function withLock(phone, fn) {
  const lock = phoneLocks.get(phone);

  if (lock && lock.processing) {
    // Ya hay uno procesándose — guardar este como "pendiente" (reemplaza al anterior pendiente)
    lock.pending = fn;
    logger.info(`[Lock] ${phone} ya se está procesando, encolado`);
    return null;
  }

  const entry = { processing: true, pending: null };
  phoneLocks.set(phone, entry);

  try {
    const result = await fn();

    // Procesar pendiente si hay uno
    while (entry.pending) {
      const nextFn = entry.pending;
      entry.pending = null;
      logger.info(`[Lock] ${phone} procesando mensaje encolado`);
      await nextFn();
    }

    return result;
  } finally {
    entry.processing = false;
    phoneLocks.delete(phone);
  }
}

// ── Control de "esperando respuesta" ────────────────────────────────────
// Después de responder, marca timestamp. Sirve para evitar saludos repetidos.
const lastBotReply = new Map();
const lastUserMessage = new Map();

function markBotReplied(phone) {
  lastBotReply.set(phone, Date.now());
}

function markUserMessage(phone) {
  lastUserMessage.set(phone, Date.now());
}

function getLastBotReplyTime(phone) {
  return lastBotReply.get(phone) || 0;
}

function getLastUserMessageTime(phone) {
  return lastUserMessage.get(phone) || 0;
}

// ── Anti-loop: protección contra respuestas repetidas ───────────────────
// Si respondimos más de N veces en M segundos sin respuesta del usuario, frenar
const replyBurst = new Map();
const BURST_WINDOW_MS = 30000; // 30 segundos
const BURST_MAX = 2; // máximo 2 respuestas del bot en 30s sin respuesta del user

function isBurstLimited(phone) {
  const now = Date.now();
  const entry = replyBurst.get(phone);

  if (!entry || now - entry.windowStart > BURST_WINDOW_MS) {
    replyBurst.set(phone, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > BURST_MAX) {
    logger.warn(`[AntiLoop] ${phone} excedió ${BURST_MAX} respuestas en ${BURST_WINDOW_MS / 1000}s — bloqueando`);
    return true;
  }
  return false;
}

function resetBurst(phone) {
  replyBurst.delete(phone);
}

// ── Cleanup periódico ───────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
  }
  // Limpiar lastBotReply/lastUserMessage de más de 24h
  const DAY = 24 * 60 * 60 * 1000;
  for (const [phone, ts] of lastBotReply) {
    if (now - ts > DAY) lastBotReply.delete(phone);
  }
  for (const [phone, ts] of lastUserMessage) {
    if (now - ts > DAY) lastUserMessage.delete(phone);
  }
  for (const [phone, entry] of replyBurst) {
    if (now - entry.windowStart > BURST_WINDOW_MS * 2) replyBurst.delete(phone);
  }
}, 60000);

module.exports = {
  isDuplicate,
  withLock,
  markBotReplied,
  markUserMessage,
  getLastBotReplyTime,
  getLastUserMessageTime,
  isBurstLimited,
  resetBurst,
};
