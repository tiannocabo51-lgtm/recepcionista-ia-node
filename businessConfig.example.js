// ┌─────────────────────────────────────────────────────────────────────────┐
// │  PLANTILLA DE CONFIGURACIÓN DEL NEGOCIO                                │
// │  Copiá este archivo a  src/utils/businessConfig.js  y completá        │
// │  con los datos reales del cliente.                                     │
// └─────────────────────────────────────────────────────────────────────────┘

module.exports = {
  nombre: 'Nombre del Negocio',
  nombreRecepcionista: 'Nombre de la recepcionista virtual',
  descripcionCorta: 'Breve descripción del negocio (1 línea)',
  instagram: '@cuenta_instagram',
  whatsappHumano: process.env.RECEPTIONIST_PHONE || '5492235551234',

  ubicacion: {
    direccion: 'Calle 123',
    ciudad: 'Ciudad',
    provincia: 'Provincia',
    referencia: 'Entre calle A y calle B',
    estacionamiento: 'Sí / No / Descripción',
    mapsLink: 'https://maps.google.com/?q=...',
  },

  horarios: [
    { dia: 'Lunes a viernes', horario: '09:00 a 18:00' },
    { dia: 'Sábado', horario: '09:00 a 13:00' },
    { dia: 'Domingo y feriados', horario: 'Cerrado' },
  ],

  formasDePago: [
    'Efectivo',
    'Transferencia bancaria (Alias: negocio.alias)',
    'Mercado Pago (Alias: negocio.mp)',
    'Tarjeta de débito',
    'Tarjeta de crédito',
  ],

  politicas: {
    turnos: 'La atención es con turno previo.',
    cancelacion: 'Se puede cancelar o reprogramar sin costo.',
    llegadaTarde: 'Si llegás tarde, se atiende según disponibilidad.',
    noShow: 'No hay penalización formal.',
    senas: 'No se requiere seña.',
    menores: 'Se atienden menores con autorización.',
    reembolsos: 'No se realizan reembolsos.',
    facturacion: 'Se emite factura A/B/C.',
    primeraVez: 'La primera consulta es sin cargo.',
  },

  agenda: {
    duracionMinimaTurno: 30,        // minutos
    tiempoEntreTurnos: 10,          // minutos de gap entre turnos
    anticipacionMaxima: null,        // días máx para agendar (null = sin límite)
    anticipacionMinima: 0,           // horas mínimas antes del turno
    sobreturnos: false,              // permitir sobreturnos
    reprogramaciones: true,          // permitir reprogramar
    confirmacionAutomatica: true,    // true = confirma al toque, false = espera aprobación del dueño
  },

  profesionales: [
    // Un objeto por profesional. Si es un solo profesional, poner uno.
    {
      nombre: 'Nombre Completo',
      rol: 'Especialista / Dueño',
      servicios: 'Todos',             // o lista de nombres de servicios
      horario: 'Lunes a viernes de 9:00 a 18:00',
      descanso: '13:00 a 14:00',      // null si no tiene
      diaLibre: 'Sábado',             // null si no tiene
      observaciones: '',
    },
  ],

  servicios: [
    // Copiar este formato para cada servicio:
    { nombre: 'Consulta inicial', categoria: 'Evaluaciones', duracionMinutos: 15, precio: 0, descripcion: 'Evaluación personalizada sin cargo.' },
    { nombre: 'Servicio ejemplo 1', categoria: 'Categoría A', duracionMinutos: 60, precio: 25000, descripcion: 'Descripción del servicio.' },
    { nombre: 'Servicio ejemplo 2', categoria: 'Categoría B', duracionMinutos: 45, precio: 18000, descripcion: 'Descripción del servicio.' },
  ],

  promociones: [
    // Dejar vacío si no hay promos activas. Formato:
    // { nombre: 'Promo X', descripcion: '...', precio: 50000, vigenteHasta: '2026-12-31' },
  ],

  combinaciones: [
    // Servicios que se pueden combinar en la misma sesión. Dejar vacío si no aplica.
    // 'Servicio A + Servicio B (se pueden combinar)',
  ],

  contraindicaciones: [
    // Restricciones médicas o de seguridad para ciertos servicios. Dejar vacío si no aplica.
    // 'No se puede hacer X si está embarazada',
  ],

  frecuenciaRecomendada: {
    // Frecuencia sugerida para repetir tratamientos. Dejar vacío si no aplica.
    // 'Nombre del servicio': 'Cada X semanas/meses',
  },

  preguntasFrecuentes: {
    // Preguntas frecuentes que la IA responde automáticamente.
    // '¿Pregunta?': 'Respuesta.',
  },

  temasQueDerivanAHumano: [
    'Quejas o reclamos',
    'Consultas que requieran evaluación profesional',
    'Reclamos sobre pagos ya realizados',
    'Cualquier pregunta que la IA no pueda responder con seguridad',
  ],

  mensajesIA: {
    saludo: 'Hola! Soy {nombre}, la asistente de {negocio}, ¿en qué puedo ayudarte?',
    confirmacionTurno: 'Listo! Tu turno quedó agendado:\n{servicio} — {fecha} a las {hora}\nTe esperamos!',
    despedida: 'Gracias por contactarnos, cualquier cosa nos escribís!',
    derivacion: 'Te comunico con un profesional para que responda tu consulta.',
    frasesQueUsar: [
      // Frases que refuerzan el tono deseado
      'Estamos para ayudarte',
    ],
    frasesProhibidas: [
      // Palabras que la IA NUNCA debe usar
      'sistema automatizado', 'virtual', 'bot', 'inteligencia artificial',
    ],
    tono: 'cercano y profesional',   // cercano / formal / cálido / etc.
    emojis: true,                     // false para un tono más profesional
    usarNombreCliente: true,          // usar el nombre del cliente en las respuestas
  },

  recordatorios: {
    antesDeTurno: '2h',               // '2h' = 2 horas antes, 'dia_anterior_noche' = la noche anterior
    pedirConfirmacion: false,          // pedir que confirme asistencia
    postTratamiento: false,            // mandar mensaje después del tratamiento
    clientesInactivos: true,           // contactar leads inactivos
    avisoPromociones: true,            // avisar promos nuevas
    cumpleanos: false,                 // felicitar cumpleaños
  },

  dashboard: {
    metricas: ['turnos_hoy', 'clientes_nuevos', 'cancelaciones', 'proximo_turno'],
    reportes: ['servicios_mas_vendidos', 'tasa_cancelacion', 'ingresos_periodo', 'clientes_frecuentes', 'comparacion_mes_anterior'],
    acceso: 'Solo el dueño',
  },

  datosCliente: ['nombre_completo', 'fecha_nacimiento', 'historial_tratamientos', 'total_gastado'],

  marketing: {
    whatsappMasivo: false,             // envíos masivos de WhatsApp
    promosCumpleanos: false,           // promo automática por cumpleaños
    referidos: false,                  // programa de referidos
  },

  // Contactos que la IA debe ignorar (no responder). Útil si se usa un WhatsApp personal.
  contactosBloqueados: [
    // '5492231234567',
  ],
};
