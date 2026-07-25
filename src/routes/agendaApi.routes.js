const express = require('express');
const router = express.Router();
const appts = require('../db/appointments.repository');
const blocks = require('../db/blocks.repository');
const cfg = require('../utils/businessConfig');

function parseHour(str) {
  if (!str) return 9;
  const m = str.match(/(\d{1,2})/);
  return m ? parseInt(m[1], 10) : 9;
}

function getHours() {
  const starts = cfg.horarios.filter(h => h.horario !== 'Cerrado').map(h => parseHour(h.horario.split(' a ')[0]));
  const ends = cfg.horarios.filter(h => h.horario !== 'Cerrado').map(h => parseHour(h.horario.split(' a ')[1]));
  return { start: Math.min(...starts, 9), end: Math.max(...ends, 19) };
}

router.get('/agenda', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  try {
    const [appointments, blks] = await Promise.all([
      appts.findRange(from, to),
      blocks.list(from, to)
    ]);
    const services = (cfg.servicios || []).map(s => ({ n: s.nombre, c: '#818cf8' }));
    res.json({
      hours: getHours(),
      professionals: [{ id: 1, name: cfg.nombre || 'Profesional', color: '#818cf8' }],
      services,
      appointments: appointments.map(a => ({
        id: a.id, name: a.name, phone: a.phone, srv: a.service,
        date: a.appointment_date, from: a.from_min, dur: a.duration || 45,
        st: a.status, color: a.color || '#818cf8', pro: 1,
        price: a.price || null, dep: a.deposit || null,
        notes: a.notes || null, visits: 1
      })),
      blocks: blks.map(b => ({
        id: b.id, date: b.block_date, from: b.from_min, dur: b.duration, reason: b.reason
      }))
    });
  } catch (e) {
    console.error('agenda api error', e);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/appointment', async (req, res) => {
  const { id, name, phone, srv, professional, date, from, duration, status, color, price, deposit, notes } = req.body;
  try {
    const time = String(Math.floor(from / 60)).padStart(2, '0') + ':' + String(from % 60).padStart(2, '0');
    const row = await appts.saveFull({ id, name, phone, service: srv, date, time, from_min: from, duration: duration || 45, status: status || 'pendiente', color, price, deposit, professional, notes });
    res.json(row);
  } catch (e) {
    console.error('save appointment error', e);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/appointment/move', async (req, res) => {
  const { id, date, from, duration, professional } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    const time = String(Math.floor(from / 60)).padStart(2, '0') + ':' + String(from % 60).padStart(2, '0');
    await appts.move(id, date, time, from, duration);
    res.json({ ok: true });
  } catch (e) {
    console.error('move appointment error', e);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/block', async (req, res) => {
  const { id, date, from, duration, reason } = req.body;
  try {
    const overlap = await blocks.overlaps(date, from, duration);
    if (overlap && (!id || overlap.id !== id)) return res.status(409).json({ error: 'overlap' });
    const row = id ? await blocks.update(id, { from, duration, reason }) : await blocks.create({ date, from, duration, reason });
    res.json(row);
  } catch (e) {
    console.error('block error', e);
    res.status(500).json({ error: 'internal' });
  }
});

router.delete('/block/:id', async (req, res) => {
  try {
    await blocks.remove(req.params.id);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
