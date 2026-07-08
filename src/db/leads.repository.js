const pool = require('./pool');

const ESTADOS = ['nuevo', 'consultando', 'turno', 'cliente', 'frio'];

// Crea el lead si no existe. No pisa datos si ya está.
async function ensureLead(phone) {
  await pool.query(
    `INSERT INTO leads (phone) VALUES ($1)
     ON CONFLICT (phone) DO NOTHING`,
    [phone]
  );
}

// Actualiza estado/interes/nombre/notas de un lead (solo los campos que se pasan).
async function updateLead(phone, { nombre, estado, interes, notas }) {
  const estadoValido = ESTADOS.includes(estado) ? estado : null;
  await pool.query(
    `INSERT INTO leads (phone, nombre, estado, interes, notas, ultimo_contacto)
     VALUES ($1, $2, COALESCE($3, 'nuevo'), $4, $5, now())
     ON CONFLICT (phone) DO UPDATE SET
       nombre = COALESCE($2, leads.nombre),
       estado = COALESCE($3, leads.estado),
       interes = COALESCE($4, leads.interes),
       notas = COALESCE($5, leads.notas),
       ultimo_contacto = now()`,
    [phone, nombre || null, estadoValido, interes || null, notas || null]
  );
}

async function touchContact(phone) {
  await pool.query(
    `UPDATE leads SET ultimo_contacto = now() WHERE phone = $1`,
    [phone]
  );
}

async function listLeads(estado) {
  if (estado && ESTADOS.includes(estado)) {
    const r = await pool.query(
      `SELECT phone, nombre, estado, interes, ultimo_contacto FROM leads
       WHERE estado = $1 ORDER BY ultimo_contacto DESC`,
      [estado]
    );
    return r.rows;
  }
  const r = await pool.query(
    `SELECT phone, nombre, estado, interes, ultimo_contacto FROM leads
     ORDER BY ultimo_contacto DESC`
  );
  return r.rows;
}

async function countByEstado() {
  const r = await pool.query(
    `SELECT estado, COUNT(*)::int AS n FROM leads GROUP BY estado`
  );
  const out = {};
  for (const e of ESTADOS) out[e] = 0;
  for (const row of r.rows) out[row.estado] = row.n;
  return out;
}

async function getLead(phone) {
  const r = await pool.query(`SELECT phone, estado, ultimo_contacto FROM leads WHERE phone = $1`, [phone]);
  return r.rows[0] || null;
}

module.exports = { ESTADOS, ensureLead, updateLead, touchContact, listLeads, countByEstado, getLead };
