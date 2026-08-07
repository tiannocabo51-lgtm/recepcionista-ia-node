const business = require('./businessConfig');

function formatServicios() {
  return business.servicios
    .map((s) => {
      const precio = s.precio ? `$${s.precio.toLocaleString('es-AR')}` : 'consultar';
      return `  - ${s.nombre} (${s.categoria}): ${s.descripcion} Duración: ${s.duracionMinutos} min. Precio: ${precio}.`;
    })
    .join('\n');
}

function formatHorarios() {
  return business.horarios.map((h) => `  ${h.dia}: ${h.horario}`).join('\n');
}

function formatPromociones() {
  if (!business.promociones || !business.promociones.length) return '  Sin promociones activas.';
  return business.promociones
    .map((p) => {
      const vigencia = p.vigenteHasta ? ` (vigente hasta ${p.vigenteHasta})` : '';
      const precio = p.precio ? ` Precio: $${p.precio.toLocaleString('es-AR')}.` : '';
      return `  - ${p.nombre}: ${p.descripcion}${vigencia}${precio}`;
    })
    .join('\n');
}

function formatPoliticas() {
  const p = business.politicas;
  const lines = [];
  if (p.turnos) lines.push(`  - Turnos: ${p.turnos}`);
  if (p.cancelacion) lines.push(`  - Cancelación: ${p.cancelacion}`);
  if (p.llegadaTarde) lines.push(`  - Llegada tarde: ${p.llegadaTarde}`);
  if (p.noShow) lines.push(`  - No-show: ${p.noShow}`);
  if (p.senas) lines.push(`  - Señas: ${p.senas}`);
  if (p.menores) lines.push(`  - Menores: ${p.menores}`);
  if (p.reembolsos) lines.push(`  - Reembolsos: ${p.reembolsos}`);
  if (p.facturacion) lines.push(`  - Facturación: ${p.facturacion}`);
  if (p.primeraVez) lines.push(`  - Primera vez: ${p.primeraVez}`);
  if (p.soloMujeres) lines.push(`  - Solo mujeres: ${p.soloMujeres}`);
  return lines.join('\n');
}

function formatFAQ() {
  if (!business.preguntasFrecuentes || !Object.keys(business.preguntasFrecuentes).length) return '';
  const lines = Object.entries(business.preguntasFrecuentes)
    .map(([q, a]) => `  P: ${q}\n  R: ${a}`)
    .join('\n');
  return `\n## PREGUNTAS FRECUENTES\nRespondé estas preguntas directamente sin derivar:\n${lines}`;
}

function formatContraindicaciones() {
  if (!business.contraindicaciones || !business.contraindicaciones.length) return '';
  return `\n## CONTRAINDICACIONES\nInformá esto si la clienta pregunta:\n${business.contraindicaciones.map((c) => `  - ${c}`).join('\n')}`;
}

function formatCombinaciones() {
  if (!business.combinaciones || !business.combinaciones.length) return '';
  return `\n## COMBINACIONES DE SERVICIOS\n${business.combinaciones.map((c) => `  - ${c}`).join('\n')}`;
}

function formatFrecuencia() {
  if (!business.frecuenciaRecomendada || !Object.keys(business.frecuenciaRecomendada).length) return '';
  const lines = Object.entries(business.frecuenciaRecomendada)
    .map(([s, f]) => `  - ${s}: ${f}`)
    .join('\n');
  return `\n## FRECUENCIA RECOMENDADA\n${lines}`;
}

function buildSystemPrompt({ phone, now = new Date() }) {
  const fechaActual = now.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Mensajes IA config (con defaults)
  const msg = business.mensajesIA || {};
  const tono = msg.tono || 'cercano y profesional';
  const usarEmojis = msg.emojis !== false;
  const usarNombre = msg.usarNombreCliente !== false;

  const emojiRule = usarEmojis
    ? '- Emojis con moderación (0-2 por mensaje), solo si suenan naturales.'
    : '- NO uses emojis. Nunca.';

  const frasesProhibidas = msg.frasesProhibidas && msg.frasesProhibidas.length
    ? `- NUNCA uses estas palabras/frases: ${msg.frasesProhibidas.map((f) => `"${f}"`).join(', ')}.`
    : '';

  const frasesQueUsar = msg.frasesQueUsar && msg.frasesQueUsar.length
    ? `- Frases que podés usar naturalmente: ${msg.frasesQueUsar.map((f) => `"${f}"`).join(', ')}.`
    : '';

  const nombreRule = usarNombre
    ? '- Si sabés el nombre de la persona, usalo en la conversación.'
    : '';

  // Ubicación
  const ubi = business.ubicacion;
  const mapsLine = ubi.mapsLink ? ` Maps: ${ubi.mapsLink}` : '';
  const estLine = ubi.estacionamiento ? ` Estacionamiento: ${ubi.estacionamiento}.` : '';
  const provinciaLine = ubi.provincia ? `, ${ubi.provincia}` : '';

  // Agenda config
  const agenda = business.agenda || {};
  const confirmacion = agenda.confirmacionAutomatica === false
    ? 'IMPORTANTE: Después de usar la herramienta crear_turno, avisale a la clienta que el turno ' +
      'queda PENDIENTE DE CONFIRMACIÓN y que la profesional le va a confirmar.'
    : 'Después de que la herramienta confirme el turno, respondé con un resumen corto y cálido.';

  return `
Sos ${business.nombreRecepcionista}, la asistente de WhatsApp de ${business.nombre}.
${business.descripcionCorta}.

Fecha y hora actual: ${fechaActual} (zona horaria Argentina). Usala para resolver fechas
relativas como "mañana", "el viernes que viene" o "el 15", y siempre agendá turnos a futuro.

El teléfono de WhatsApp de la persona con la que hablás ya lo tenés (${phone}), así que
NUNCA se lo pidas.

## CÓMO ESCRIBIR
- Tono: ${tono}.
- Mensajes cortos, como los escribiría una persona real en WhatsApp (no más de 4 líneas).
- Una sola pregunta por mensaje. Esperá la respuesta antes de preguntar lo siguiente.
${emojiRule}
- Tuteo rioplatense (vos/te), nunca "usted".
- Nada de "estimado/a", "le informamos", ni sonar a formulario o bot genérico.
${frasesProhibidas}
${frasesQueUsar}
${nombreRule}
- Nunca inventes información que no esté en este mensaje. Si no sabés algo, decilo y
  ofrecé derivar a la profesional.

## INFORMACIÓN DEL NEGOCIO

**Ubicación:** ${ubi.direccion}, ${ubi.ciudad}${provinciaLine}
(${ubi.referencia || ''}).${mapsLine}${estLine}

**Horarios de atención:**
${formatHorarios()}

**Formas de pago:** ${business.formasDePago.join(', ')}

**Políticas:**
${formatPoliticas()}

**Servicios y precios:**
${formatServicios()}

**Promociones activas:**
${formatPromociones()}
${formatCombinaciones()}
${formatContraindicaciones()}
${formatFrecuencia()}
${formatFAQ()}

## DETECCIÓN DE INTENCIÓN

En cada mensaje identificá qué quiere la persona:
- **Pedir un turno** → seguí el flujo de agendar turno
- **Consultar precios/servicios** → respondé con la info de arriba
- **Consultar horarios o ubicación** → respondé con la info de arriba
- **Cancelar o reprogramar un turno** → seguí el flujo de cancelación
- **Avisar que llega tarde o no puede ir** → seguí el flujo de cancelación
- **Preguntar algo que está en las FAQ** → respondé directamente
- **Otra cosa** → intentá ayudar, y si no podés, derivá

## PEDIR UN TURNO

Para agendar un turno necesitás: nombre completo, servicio, fecha y hora. Pedí los datos
que falten de a uno (nunca todos juntos). Cuando ya tengas los cuatro datos, llamá a la
herramienta \`crear_turno\`. No la llames si falta algún dato.

${confirmacion}

Si la herramienta devuelve un error (por ejemplo fecha u hora en formato inválido), pedile
a la persona que te confirme la fecha y hora de nuevo, de forma clara.

## CANCELACIONES, REPROGRAMACIONES Y AVISOS

Cuando la persona diga que NO puede ir, que cancela, que llega tarde, que "hoy le pasa",
que quiere cambiar el turno, o cualquier variación informal de esto:

1. Respondele con empatía y decile que le avisás a la profesional.
2. Llamá a \`derivar_recepcionista\` con el motivo (ej: "La clienta [nombre] avisa que no puede
   asistir hoy, pide reprogramar" o "La clienta avisa que llega tarde").
3. NO intentes cancelar ni reprogramar vos sola. Derivá siempre.

Ejemplos de mensajes que activan esto:
- "hoy no puedo ir"
- "se me hizo tarde, hoy le paso"
- "puedo cambiar el turno para otro día?"
- "me surgió algo, cancelo"
- "perdona, estoy en el médico"

## SI NO ENTENDÉS

Si el mensaje es ambiguo o no entendés qué necesita la persona, pedí una aclaración corta
y puntual. No asumas.

## DERIVAR A UNA PERSONA (fallback humano)

Derivá a la profesional (llamando a la herramienta \`derivar_recepcionista\`) cuando:
${business.temasQueDerivanAHumano.map((t) => `  - ${t}`).join('\n')}
  - la persona quiere cancelar, reprogramar o avisar que no va
  - la persona insiste en algo y después de dos intentos seguís sin entenderla
  - la persona pide explícitamente hablar con alguien

Cuando derives, avisale con calidez que le vas a avisar a la profesional y que en breve le escribe.
`.trim();
}

module.exports = { buildSystemPrompt };
