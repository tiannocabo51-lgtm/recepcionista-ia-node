// Único archivo que hay que editar para adaptar el agente a otra estética.
// Todo lo que pongas acá se le pasa a Claude como contexto del negocio.

module.exports = {
  nombre: 'Estética Lumina',
  nombreRecepcionista: 'Lu',
  descripcionCorta: 'Centro de estética especializado en tratamientos faciales, corporales y depilación',
  instagram: '@estetica.lumina',
  whatsappHumano: process.env.RECEPTIONIST_PHONE || '5492235551234',

  ubicacion: {
    direccion: 'Av. Colón 1450, piso 2, oficina 5',
    ciudad: 'Mar del Plata',
    referencia: 'A dos cuadras del Obelisco, edificio con frente azul',
    mapsLink: 'https://maps.google.com/?q=Av+Colon+1450+Mar+del+Plata',
  },

  horarios: [
    { dia: 'Lunes a jueves', horario: '09:00 a 19:00 hs' },
    { dia: 'Viernes', horario: '09:00 a 18:00 hs' },
    { dia: 'Sábado', horario: '09:00 a 14:00 hs' },
    { dia: 'Domingo', horario: 'Cerrado' },
  ],

  formasDePago: [
    'Efectivo',
    'Transferencia bancaria',
    'Mercado Pago',
    'Tarjeta de débito',
    'Tarjeta de crédito (1 cuota sin recargo, 3 y 6 cuotas con recargo)',
  ],

  politicas: {
    cancelacion: 'Podés cancelar o reprogramar tu turno hasta 24 horas antes sin cargo. Cancelaciones con menos de 24 horas tienen un cargo del 30% del tratamiento.',
    llegadaTarde: 'Si llegás más de 15 minutos tarde, no podemos garantizar el turno completo.',
    primeraVez: 'En tu primera visita hacemos una valoración de piel sin costo antes del tratamiento.',
  },

  servicios: [
    {
      nombre: 'Facial Hidratación Profunda',
      categoria: 'Facial',
      duracionMinutos: 60,
      precio: 15000,
      descripcion: 'Restaura la hidratación y luminosidad de la piel con ácido hialurónico y vitamina C.',
    },
    {
      nombre: 'Tratamiento Anti-Manchas',
      categoria: 'Facial',
      duracionMinutos: 75,
      precio: 22000,
      descripcion: 'Ácidos despigmentantes y luz pulsada para reducir manchas solares y marcas de acné.',
    },
    {
      nombre: 'Depilación Láser — Axilas',
      categoria: 'Depilación Láser',
      duracionMinutos: 20,
      precio: 8000,
      descripcion: 'Depilación definitiva con láser diodo de última generación.',
    },
    {
      nombre: 'Depilación Láser — Piernas Completas',
      categoria: 'Depilación Láser',
      duracionMinutos: 90,
      precio: 38000,
      descripcion: 'Depilación definitiva de piernas completas, de cadera a pie.',
    },
    {
      nombre: 'Masaje Descontracturante',
      categoria: 'Corporal',
      duracionMinutos: 60,
      precio: 12000,
      descripcion: 'Masaje profundo de tejidos para liberar tensiones musculares.',
    },
    {
      nombre: 'Lifting de Pestañas',
      categoria: 'Ojos',
      duracionMinutos: 75,
      precio: 18000,
      descripcion: 'Curva y eleva las pestañas naturales por 6 a 8 semanas, sin extensiones.',
    },
  ],

  promociones: [
    {
      nombre: 'Julio Láser',
      descripcion: '30% OFF en tu primera sesión de depilación láser en cualquier zona',
      vigenteHasta: '2026-07-31',
      condiciones: 'Solo para clientas nuevas en depilación láser. No acumulable con otros descuentos.',
    },
  ],

  temasQueDerivanAHumano: [
    'quejas graves',
    'reacciones adversas a tratamientos',
    'presupuestos especiales o paquetes a medida',
    'preguntas médicas o dermatológicas',
    'problemas con pagos ya realizados',
  ],
};
