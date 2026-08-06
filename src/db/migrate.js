const pool = require('./pool');
const logger = require('../utils/logger');

const MIGRATIONS = [
  // Set timezone for CURRENT_DATE / CURRENT_TIMESTAMP consistency
  `ALTER DATABASE CURRENT_DATABASE() SET timezone TO 'America/Argentina/Buenos_Aires'`,
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
  logger.info('Migraciones de agenda completadas');
}

module.exports = { runMigrations };
