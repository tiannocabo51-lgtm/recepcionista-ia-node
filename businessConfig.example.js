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
    referencia: 'Entre calle A y calle B',
    mapsLink: 'https://maps.google.com/?q=...',
  },

  horarios: [
    { dia: 'Lunes a viernes', horario: '09:00 a 18:00 hs' },
    { dia: 'Sábado', horario: '09:00 a 13:00 hs' },
    { dia: 'Domingo y feriados', horario: 'Cerrado' },
  ],

  formasDePago: [
    'Efectivo',
    'Transferencia bancaria',
    'Mercado Pago',
    'Tarjeta de débito',
    'Tarjeta de crédito',
  ],

  politicas: {
    turnos: 'La atención es con turno previo.',
    cancelacion: 'Se puede cancelar o reprogramar sin costo.',
    llegadaTarde: 'Si llegás tarde, se atiende según disponibilidad.',
    primeraVez: 'La primera consulta es sin cargo.',
  },

  servicios: [
    // Copiar este formato para cada servicio:
    // { nombre: 'Nombre del servicio', categoria: 'Categoría', duracionMinutos: 30, precio: 10000, descripcion: 'Descripción breve.' },
    { nombre: 'Consulta inicial', categoria: 'Evaluaciones', duracionMinutos: 15, precio: 0, descripcion: 'Evaluación personalizada sin cargo.' },
    { nombre: 'Servicio ejemplo 1', categoria: 'Categoría A', duracionMinutos: 60, precio: 25000, descripcion: 'Descripción del servicio.' },
    { nombre: 'Servicio ejemplo 2', categoria: 'Categoría B', duracionMinutos: 45, precio: 18000, descripcion: 'Descripción del servicio.' },
  ],

  promociones: [
    // Dejar vacío si no hay promos activas. Formato:
    // { nombre: 'Promo X', descripcion: '...', vigenteHasta: '2026-12-31', condiciones: '...' },
  ],

  temasQueDerivanAHumano: [
    'quejas o reclamos',
    'consultas médicas que requieran evaluación profesional',
    'reclamos sobre pagos ya realizados',
  ],
};
