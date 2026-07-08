const Anthropic = require('@anthropic-ai/sdk');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { buildSystemPrompt } = require('../utils/systemPrompt');
const conversationsRepo = require('../db/conversations.repository');
const appointmentService = require('./appointmentService');
const handoffsRepo = require('../db/handoffs.repository');
const leadsRepo = require('../db/leads.repository');
const leadClassifier = require('./leadClassifier');
const whatsappService = require('./whatsappService');
const business = require('../utils/businessConfig');

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const MAX_TOOL_ROUNDS = 4;

const TOOLS = [
  {
    name: 'crear_turno',
    description:
      'Guarda un turno para la clienta. Usar solo cuando ya se sabe el nombre completo, ' +
      'el servicio, la fecha y la hora. Si falta algún dato, hay que preguntarlo antes de llamar esta herramienta.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre completo de la persona' },
        service: { type: 'string', description: 'Servicio o tratamiento solicitado' },
        date: { type: 'string', description: 'Fecha del turno en formato YYYY-MM-DD' },
        time: { type: 'string', description: 'Hora del turno en formato HH:MM (24hs)' },
        notes: { type: 'string', description: 'Notas adicionales, opcional' },
      },
      required: ['name', 'service', 'date', 'time'],
    },
  },
  {
    name: 'clasificar_lead',
    description:
      'Registra o actualiza la clasificacion del cliente en el CRM. Llamala cuando entiendas ' +
      'en que etapa esta el cliente o que le interesa, SIN avisarle ni mencionarlo (es interno). ' +
      'Estados: "nuevo" (recien escribe), "consultando" (pregunta precios/servicios pero no reservo), ' +
      '"turno" (saco o esta por sacar turno), "cliente" (ya vino o es recurrente), "frio" (pregunto y no avanzo).',
    input_schema: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['nuevo', 'consultando', 'turno', 'cliente', 'frio'], description: 'Etapa del cliente' },
        nombre: { type: 'string', description: 'Nombre del cliente si lo dijo' },
        interes: { type: 'string', description: 'Servicio/s que le interesan, ej: "Hifu, Depilacion"' },
        notas: { type: 'string', description: 'Nota interna breve, opcional' },
      },
      required: ['estado'],
    },
  },
  {
    name: 'derivar_recepcionista',
    description:
      'Deriva la conversación a la recepcionista humana. Usar ante quejas graves, temas médicos, ' +
      'pedidos fuera del alcance del agente, o cuando después de dos intentos no se entiende a la persona.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Motivo breve de la derivación' },
      },
      required: ['reason'],
    },
  },
];

function notifyOwner(text) {
  if (!business.whatsappHumano) return;
  whatsappService
    .sendMessage(business.whatsappHumano, text)
    .catch((err) => logger.error('No se pudo notificar al dueño del negocio:', err.message));
}

async function executeTool(name, input, phone) {
  if (name === 'crear_turno') {
    const result = await appointmentService.createAppointment({ ...input, phone });
    if (result.ok) {
      notifyOwner(
        `📅 Nuevo turno agendado\n` +
          `Cliente: ${result.appointment.name} (${phone})\n` +
          `Servicio: ${result.appointment.service}\n` +
          `Fecha: ${result.appointment.appointment_date} ${result.appointment.appointment_time}` +
          (result.appointment.notes ? `\nNotas: ${result.appointment.notes}` : '')
      );
      return JSON.stringify({
        ok: true,
        turno: {
          nombre: result.appointment.name,
          servicio: result.appointment.service,
          fecha: result.appointment.appointment_date,
          hora: result.appointment.appointment_time,
        },
        direccion: business.ubicacion.direccion,
      });
    }
    return JSON.stringify({ ok: false, error: result.error });
  }

  if (name === 'clasificar_lead') {
    await leadsRepo
      .updateLead(phone, input)
      .catch((err) => logger.error('No se pudo clasificar el lead:', err.message));
    return JSON.stringify({ ok: true, clasificado: true });
  }

  if (name === 'derivar_recepcionista') {
    await handoffsRepo.createHandoff(phone, input.reason);
    notifyOwner(`Derivación de ${phone}: ${input.reason}`);
    return JSON.stringify({ ok: true, derivado: true });
  }

  return JSON.stringify({ ok: false, error: `Herramienta desconocida: ${name}` });
}

function extractText(content) {
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

// Procesa un mensaje entrante de un teléfono y devuelve el texto de respuesta final.
async function handleMessage(phone, userMessage) {
  const history = await conversationsRepo.getRecentHistory(phone);
  await conversationsRepo.saveMessage(phone, 'user', userMessage);
  await leadsRepo.ensureLead(phone).catch(() => {});

  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const system = buildSystemPrompt({ phone, now: new Date() });

  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const response = await anthropic.messages.create({
      model: config.claudeModel,
      max_tokens: config.claudeMaxTokens,
      system,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason !== 'tool_use') {
      finalText = extractText(response.content);
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const resultJson = await executeTool(block.name, block.input, phone);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultJson });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText) {
    finalText =
      'Perdón, se me complicó procesar tu mensaje. ¿Podés reformularlo? Si preferís, ' +
      'te derivo directo con la recepcionista.';
  }

  await conversationsRepo.saveMessage(phone, 'assistant', finalText);

  // CRM: clasificar si paso suficiente tiempo desde la ultima clasificacion (opcion C)
  leadClassifier.maybeClassify(phone).catch(() => {});

  return finalText;
}

module.exports = { handleMessage };
