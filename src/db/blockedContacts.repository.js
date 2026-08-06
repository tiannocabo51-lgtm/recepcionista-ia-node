const pool = require('./pool');
const logger = require('../utils/logger');

// Cache en memoria para no consultar la DB en cada mensaje
let cache = null;

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blocked_contacts (
      id      SERIAL PRIMARY KEY,
      phone   VARCHAR(30) UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function loadCache() {
  try {
    await ensureTable();
    const result = await pool.query('SELECT phone FROM blocked_contacts ORDER BY created_at');
    cache = new Set(result.rows.map((r) => r.phone));
    logger.info(`[BlockedContacts] ${cache.size} contactos bloqueados cargados`);
  } catch (err) {
    logger.error('[BlockedContacts] Error cargando cache:', err.message);
    cache = new Set();
  }
}

function isBlocked(phone) {
  if (!cache) return false;
  return cache.has(phone);
}

async function list() {
  if (!cache) await loadCache();
  return [...cache];
}

async function add(phone) {
  await ensureTable();
  await pool.query(
    'INSERT INTO blocked_contacts (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING',
    [phone]
  );
  if (!cache) cache = new Set();
  cache.add(phone);
}

async function remove(phone) {
  await pool.query('DELETE FROM blocked_contacts WHERE phone = $1', [phone]);
  if (cache) cache.delete(phone);
}

module.exports = { loadCache, isBlocked, list, add, remove };
