const pool = require('./pool');

// Guarda cuándo escribió cada persona por última vez. La API oficial solo deja mandar
// texto libre dentro de las 24hs siguientes a ese momento; después, solo plantillas.

async function recordInbound(phone) {
  await pool.query(
    `INSERT INTO whatsapp_windows (phone, last_inbound_at) VALUES ($1, now())
     ON CONFLICT (phone) DO UPDATE SET last_inbound_at = now()`,
    [phone]
  );
}

async function getLastInbound(phone) {
  const r = await pool.query('SELECT last_inbound_at FROM whatsapp_windows WHERE phone = $1', [phone]);
  return r.rows[0]?.last_inbound_at || null;
}

module.exports = { recordInbound, getLastInbound };
