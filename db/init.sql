-- Se ejecuta automáticamente una sola vez cuando el contenedor de Postgres
-- arranca con un volumen de datos vacío (ver docker-compose.yml).

CREATE TABLE IF NOT EXISTS appointments (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  service           VARCHAR(150) NOT NULL,
  appointment_date  DATE NOT NULL,
  appointment_time  TIME NOT NULL,
  phone             VARCHAR(30) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_phone ON appointments(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

CREATE TABLE IF NOT EXISTS conversations (
  id          SERIAL PRIMARY KEY,
  phone       VARCHAR(30) NOT NULL,
  role        VARCHAR(20) NOT NULL, -- 'user' | 'assistant'
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_phone_date ON conversations(phone, created_at);

CREATE TABLE IF NOT EXISTS handoffs (
  id          SERIAL PRIMARY KEY,
  phone       VARCHAR(30) NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id                SERIAL PRIMARY KEY,
  phone             VARCHAR(30) UNIQUE NOT NULL,
  nombre            VARCHAR(150),
  estado            VARCHAR(20) NOT NULL DEFAULT 'nuevo',
  interes           TEXT,
  notas             TEXT,
  ai_enabled        BOOLEAN NOT NULL DEFAULT true,
  followup_count    INT NOT NULL DEFAULT 0,
  last_followup_at  TIMESTAMPTZ,
  ultimo_contacto   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);

-- Columnas extra para la agenda interactiva (safe to re-run)
DO $$ BEGIN
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration    INT DEFAULT 30;
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS price       NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit     NUMERIC(12,2) DEFAULT 0;
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS color       VARCHAR(20);
  ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional INT DEFAULT 1;
END $$;

CREATE TABLE IF NOT EXISTS blocks (
  id          SERIAL PRIMARY KEY,
  block_date  DATE NOT NULL,
  from_min    INT NOT NULL,
  duration    INT NOT NULL DEFAULT 30,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blocks_date ON blocks(block_date);
