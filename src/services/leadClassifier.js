const Anthropic = require('@anthropic-ai/sdk');
const config = require('../utils/config');
const logger = require('../utils/logger');
const leadsRepo = require('../db/leads.repository');
const conversationsRepo = require('../db/conversations.repository');

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const SYSTEM = `Sos un clasificador de leads de un centro de estetica. Te paso el historial de una conversacion
de WhatsApp entre un cliente y el asistente del negocio. Devolves SOLO un JSON valido (sin texto extra) con:
{
  "estado": uno de "nuevo" | "consultando" | "turno" | "cliente" | "frio",
  "nombre": el nombre del cliente si lo dijo, o null,
  "interes": servicios que menciono separados por coma (ej "Hifu, Depilacion"), o null
}
Criterios de estado:
- "consultando": pregunto precios o servicios pero no reservo.
- "turno": saco un turno o quedo en sacarlo.
- "cliente": menciono que ya vino o es clienta habitual.
- "frio": pregunto y no avanzo / dijo que lo va a pensar.
- "nuevo": apenas saludo, sin datos suficientes.`;

async function classify(phone) {
  try {
    const history = await conversationsRepo.findByPhone(phone, 20);
    if (!history.length) return;

    const transcript = history
      .map((m) => `${m.role === 'user' ? 'Cliente' : 'Asistente'}: ${m.content}`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: config.claudeModel,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: 'user', content: transcript }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;

    const data = JSON.parse(match[0]);
    await leadsRepo.updateLead(phone, {
      estado: data.estado,
      nombre: data.nombre || null,
      interes: data.interes || null,
    });
    logger.info(`[CRM] Lead ${phone} clasificado como "${data.estado}"${data.interes ? ` (${data.interes})` : ''}`);
  } catch (err) {
    logger.error('[CRM] Error clasificando lead:', err.message);
  }
}

const MIN_MINUTOS = 3;

// Clasifica solo si nunca se hizo o si pasaron MIN_MINUTOS desde la ultima vez.
async function maybeClassify(phone) {
  try {
    const lead = await leadsRepo.getLead(phone);
    if (lead && lead.estado !== 'nuevo' && lead.ultimo_contacto) {
      const mins = (Date.now() - new Date(lead.ultimo_contacto).getTime()) / 60000;
      if (mins < MIN_MINUTOS) return;
    }
    await classify(phone);
  } catch (err) {
    logger.error('[CRM] Error en maybeClassify:', err.message);
  }
}

module.exports = { classify, maybeClassify };
