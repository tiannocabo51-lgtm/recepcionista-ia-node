const pool = require('./pool');
const logger = require('../utils/logger');

const MIGRATIONS = [
  // Set timezone for CURRENT_DATE / CURRENT_TIMESTAMP consistency
  `SET timezone TO 'America/Argentina/Buenos_Aires'`,
  // Add interactive agenda columns to appointments
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration    INT DEFAULT 30`,
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS price       NUMERIC(12,2) DEFAULT 0`,
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit     NUMERIC(12,2) DEFAULT 0`,
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color       VARCHAR(20)`,
  `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional INT DEFAULT 1`,
  // Blocks table for time-slot blocking
  `CREATE TABLE IF NOT EXISTS blocks (
     id          SERIAL PRIMARY KEY,
     block_date  DATE NOT NULL,
     from_min    INT NOT NULL,
     duration    INT NOT NULL DEFAULT 30,
     reason      TEXT,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(block_date)`,
  // Leads follow-up tracking columns
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS followup_count INT DEFAULT 0`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_followup_at TIMESTAMPTZ`,
  `ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true`,
  // Index for conversation lookups
  `CREATE INDEX IF NOT EXISTS idx_conversations_phone_created ON conversations(phone, created_at DESC)`,
  // Index for appointment date lookups
  `CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone)`,
  // Client notes (CRM)
  `CREATE TABLE IF NOT EXISTS client_notes (
     id         SERIAL PRIMARY KEY,
     phone      VARCHAR(30) NOT NULL,
     note       TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_client_notes_phone ON client_notes(phone)`,
  // Lead custom tags
  `CREATE TABLE IF NOT EXISTS lead_tags (
     id         SERIAL PRIMARY KEY,
     phone      VARCHAR(30) NOT NULL,
     tag        VARCHAR(50) NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE(phone, tag)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_lead_tags_phone ON lead_tags(phone)`,
  // Activity log
  `CREATE TABLE IF NOT EXISTS activity_log (
     id         SERIAL PRIMARY KEY,
     action     VARCHAR(60) NOT NULL,
     detail     TEXT,
     phone      VARCHAR(30),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

async function runMigrations() {
  for (const sql of MIGRATIONS) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Column/table already exists — safe to ignore
      if (err.code !== '42701' && err.code !== '42P07') {
        logger.error('Migration error:', err.message);
      }
    }
  }
  logger.info('Migraciones completadas');

  // Cleanup: remove conversations older than 90 days
  try {
    const result = await pool.query(
      `DELETE FROM conversations WHERE created_at < now() - interval '90 days'`
    );
    if (result.rowCount > 0) {
      logger.info(`[Cleanup] ${result.rowCount} mensajes antiguos eliminados (>90 días)`);
    }
  } catch (err) {
    logger.error('[Cleanup] Error limpiando conversaciones:', err.message);
  }
}

module.exports = { runMigrations };
