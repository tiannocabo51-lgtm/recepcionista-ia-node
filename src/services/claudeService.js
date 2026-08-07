const Anthropic = require('@anthropic-ai/sdk');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { buildSystemPrompt } = require('../utils/systemPrompt');
const conversationsRepo = require('../db/conversations.repository');
const appointmentService = require('./appointmentService');
const appointmentsRepo = require('../db/appointments.repository');
const handoffsRepo = require('../db/handoffs.repository');
const leadsRepo = require('../db/leads.repository');
const whatsappService = require('./whatsappService');
const business = require('../utils/businessConfig');

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

const MAX_TOOL_ROUNDS = 4;

// Tiempo mínimo entre saludos para la misma conversación
const GREETING_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 horas

const TOOLS = [
  {
    name: 'crear_turno',
    description:
      'Guarda un turno para la clienta. IMPORTANTE: NO llamar esta herramienta apenas tengas los datos. ' +
      'Primero resumí el turno al cliente (nombre, servicio, fecha, hora) y ESPERÁ a que confirme con un "sí", "dale", "perfecto", etc. ' +
      'Recién cuando el cliente confirme explícitamente, llamá esta herramienta. ' +
      'Si falta algún dato (nombre, servicio, fecha u hora), preguntalo antes.',
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
    name: 'cambiar_estado_turno',
    description:
      'Cambia el estado de un turno existente. Usar cuando la clienta confirma, cancela o quiere reprogramar su turno. ' +
      'Estados posibles: "confirmado" (cliente confirmó que va), "cancelado" (cliente cancela). ' +
      'Buscar el turno por teléfono del cliente actual.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['confirmado', 'cancelado'], description: 'Nuevo estado del turno' },
        reason: { type: 'string', description: 'Motivo del cambio, opcional' },
      },
      required: ['status'],
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

  if (name === 'cambiar_estado_turno') {
    try {
      const upcoming = await appointmentsRepo.findUpcomingByPhone(phone);
      if (!upcoming.length) {
        return JSON.stringify({ ok: false, error: 'No se encontró un turno próximo para este número' });
      }
      const appt = upcoming[0];
      const pool = require('../db/pool');
      await pool.query('UPDATE appointments SET status=$1 WHERE id=$2', [input.status, appt.id]);
      const statusLabel = input.status === 'confirmado' ? '✅ Confirmado' : '❌ Cancelado';
      notifyOwner(
        `${statusLabel}\nCliente: ${appt.name} (${phone})\nServicio: ${appt.service}\nFecha: ${appt.appointment_date} ${appt.appointment_time}` +
        (input.reason ? `\nMotivo: ${input.reason}` : '')
      );
      return JSON.stringify({ ok: true, turno: { nombre: appt.name, servicio: appt.service, fecha: appt.appointment_date, hora: appt.appointment_time, estado: input.status } });
    } catch (err) {
      logger.error('Error al cambiar estado del turno:', err.message);
      return JSON.stringify({ ok: false, error: 'No se pudo actualizar el turno' });
    }
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

/**
 * Determina contexto de la conversación para controlar saludos y comportamiento.
 */
async function getConversationContext(phone) {
  const history = await conversationsRepo.getRecentHistory(phone);
  const isNewConversation = history.length === 0;

  // Consultar timestamp del último mensaje del bot
  const pool = require('../db/pool');
  let lastAssistantTime = 0;
  try {
    const lastBotMsg = await pool.query(
      'SELECT created_at FROM conversations WHERE phone = $1 AND role = $2 ORDER BY created_at DESC LIMIT 1',
      [phone, 'assistant']
    );
    if (lastBotMsg.rows.length) {
      lastAssistantTime = new Date(lastBotMsg.rows[0].created_at).getTime();
    }
  } catch (err) {
    logger.error('Error consultando último mensaje del bot:', err.message);
  }

  const timeSinceLastReply = Date.now() - lastAssistantTime;
  const isResuming = lastAssistantTime > 0 && timeSinceLastReply > GREETING_COOLDOWN_MS;

  return { history, isNewConversation, isResuming };
}

/**
 * Procesa un mensaje entrante y devuelve el texto de respuesta.
 * options.isSystemFollowUp = true cuando lo llama el followUpService
 */
async function handleMessage(phone, userMessage, options = {}) {
  const { isSystemFollowUp = false } = options;

  const ctx = await getConversationContext(phone);

  // Guardar mensaje del usuario (no para follow-ups del sistema)
  if (!isSystemFollowUp) {
    await conversationsRepo.saveMessage(phone, 'user', userMessage);
  }

  await leadsRepo.ensureLead(phone).catch(() => {});

  const messages = [
    ...ctx.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  // System prompt con reglas anti-spam inyectadas
  let system = buildSystemPrompt({ phone, now: new Date() });

  const antiSpamRules = [
    '',
    '## REGLAS DE CONVERSACIÓN (OBLIGATORIAS)',
    '',
    '1. RESPUESTA ÚNICA: Respondé con UN SOLO mensaje. Toda la información va en una sola burbuja de WhatsApp. NUNCA dividas tu respuesta en varios mensajes separados.',
    '2. ESPERÁ AL USUARIO: Después de responder, esperá a que la persona te escriba. NUNCA envíes un segundo mensaje si la persona no respondió.',
    '3. UNA PREGUNTA POR MENSAJE: Hacé una sola pregunta por respuesta. No bombardees con preguntas.',
    '4. MENSAJES CORTOS: Máximo 4 líneas. Como lo escribiría una persona real en WhatsApp.',
  ].join('\n');

  system += antiSpamRules;

  if (ctx.isNewConversation) {
    system += '\n5. PRIMERA VEZ: Esta es la primera vez que esta persona escribe. Podés saludar y presentarte brevemente.';
  } else if (ctx.isResuming) {
    system += '\n5. CONVERSACIÓN RETOMADA: Pasaron más de 12 horas desde tu último mensaje. Podés saludar brevemente.';
  } else {
    system += '\n5. CONVERSACIÓN EN CURSO: Ya estás hablando con esta persona. NO te presentes de nuevo. NO digas "Hola, soy Juli" ni "¿En qué te puedo ayudar?". Respondé directamente a lo que dice.';
  }

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
      'Perdón, se me complicó procesar tu mensaje. ¿Podés reformularlo? Si preferís, te derivo directo con la recepcionista.';
  }

  await conversationsRepo.saveMessage(phone, 'assistant', finalText);

  return finalText;
}

module.exports = { handleMessage };
