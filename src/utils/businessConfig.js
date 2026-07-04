// Único archivo que hay que editar para adaptar el agente a otra estética.
// Todo lo que pongas acá se le pasa a Claude como contexto del negocio.

module.exports = {
  nombre: 'Simaxface',
  nombreRecepcionista: 'Martina',
  descripcionCorta: 'Centro de rejuvenecimiento facial y remodelación corporal sin cirugía ni inyecciones',
  instagram: '@simaxface_',
  whatsappHumano: process.env.RECEPTIONIST_PHONE || '5492235192504',

  ubicacion: {
    direccion: 'Garay 922',
    ciudad: 'Mar del Plata',
    referencia: 'Zona Güemes, entre Mendoza y Paunero',
    mapsLink: 'https://maps.google.com/?q=Garay+922+Mar+del+Plata',
  },

  horarios: [
    { dia: 'Lunes, miércoles y viernes', horario: '08:00 a 17:00 hs' },
    { dia: 'Martes y jueves', horario: '08:00 a 19:00 hs' },
    { dia: 'Sábado, domingo y feriados', horario: 'Cerrado' },
  ],

  formasDePago: [
    'Efectivo',
    'Transferencia bancaria',
    'Mercado Pago',
    'Tarjeta de débito',
    'Tarjeta de crédito (con recargo según cuotas)',
    'Varios tratamientos tienen descuento extra si se paga el turno online al reservar',
  ],

  politicas: {
    turnos: 'La atención es exclusivamente con turno previo, no se atiende sin haber reservado.',
    cancelacion: 'No hay multa ni costos agregados por cancelar o reprogramar el turno.',
    llegadaTarde: 'Si llegás tarde, te atendemos según la disponibilidad de agenda en ese momento (no se garantiza el turno completo).',
    primeraVez: 'La consulta y evaluación inicial es totalmente gratis, antes de decidir cualquier tratamiento.',
  },

  servicios: [
    // EVALUACIONES
    { nombre: 'Consulta / Evaluación', categoria: 'Evaluaciones', duracionMinutos: 15, precio: 0, descripcion: 'Evaluación personalizada sin cargo para recomendarte el mejor tratamiento según tus objetivos, facial o corporal.' },

    // FACIALES
    { nombre: 'Dermaplaning', categoria: 'Faciales', duracionMinutos: 40, precio: 39900, descripcion: 'Exfoliación manual que elimina células muertas y vello fino del rostro. Piel suave y lista para mejor absorción de productos.' },
    { nombre: 'Dermapen Labios', categoria: 'Faciales', duracionMinutos: 30, precio: 39900, descripcion: 'Microagujas en labios que estimulan colágeno y elastina, para labios más voluminosos y con líneas finas reducidas.' },
    { nombre: 'Puntas de diamante', categoria: 'Faciales', duracionMinutos: 30, precio: 34900, descripcion: 'Microdermoabrasión que exfolia, mejora textura y tono, y reduce arrugas finas y manchas.' },
    { nombre: 'Limpieza profunda de cutis + Hidratación', categoria: 'Faciales', duracionMinutos: 60, precio: 59900, descripcion: 'Peeling ultrasónico + microdermoabrasión + puntas de diamante. Elimina impurezas y puntos negros, piel renovada.' },
    { nombre: 'Limpieza profunda + puntas de diamante + Dermapen', categoria: 'Faciales', duracionMinutos: 60, precio: 69000, descripcion: 'Combina limpieza profunda con Dermapen para nutrición e hidratación intensiva, mejora firmeza y luminosidad.' },
    { nombre: 'Limpieza profunda + Hifu', categoria: 'Faciales', duracionMinutos: 50, precio: 79900, descripcion: 'Combo de limpieza facial profunda con sesión de Hifu para tensado.' },
    { nombre: 'Mesofilm regenerativo', categoria: 'Faciales', duracionMinutos: 40, precio: 130000, descripcion: 'Servicio regenerativo de una sesión: relleno de líneas de expresión e hidratación profunda con micropartículas celulares regenerativas.' },

    // HIFU FACIAL
    { nombre: 'Hifu Facial 2x1 (2 sesiones)', categoria: 'Hifu Facial', duracionMinutos: 30, precio: 89000, descripcion: 'Promo 2 sesiones de Hifu facial. Descuento adicional pagando en línea.' },
    { nombre: 'Hifu rostro', categoria: 'Hifu Facial', duracionMinutos: 50, precio: 62100, descripcion: 'Hifu tensado en rostro completo. Precio pagando en línea (precio normal en el local: $69.000).' },
    { nombre: 'Hifu papada', categoria: 'Hifu Facial', duracionMinutos: 25, precio: 39600, descripcion: 'Hifu Classic en papada. Precio pagando en línea (precio normal en el local: $44.000).' },
    { nombre: 'Hifu cuello', categoria: 'Hifu Facial', duracionMinutos: 25, precio: 39600, descripcion: 'Hifu en cuello. Precio pagando en línea (precio normal en el local: $44.000).' },
    { nombre: 'Hifu escote', categoria: 'Hifu Facial', duracionMinutos: 25, precio: 39600, descripcion: 'Hifu en escote. Precio pagando en línea (precio normal en el local: $44.000).' },
    { nombre: 'Hifu 10D rostro', categoria: 'Hifu Facial', duracionMinutos: 60, precio: 71100, descripcion: 'Hifu 10D en rostro completo, sesión única. Precio pagando en línea (precio normal en el local: $79.000).' },
    { nombre: 'Hifu 10D papada', categoria: 'Hifu Facial', duracionMinutos: 20, precio: 54000, descripcion: 'Hifu 10D en papada.' },
    { nombre: 'Hifu 10D cuello', categoria: 'Hifu Facial', duracionMinutos: 20, precio: 54000, descripcion: 'Hifu 10D en cuello.' },
    { nombre: 'Hifu 10D escote', categoria: 'Hifu Facial', duracionMinutos: 20, precio: 54000, descripcion: 'Hifu 10D en escote.' },
    { nombre: 'Hifu 12D rostro', categoria: 'Hifu Facial', duracionMinutos: 50, precio: 89000, descripcion: 'Ultrasonido focalizado de alta intensidad en capas profundas (SMAS). Efecto lifting natural, estimula colágeno, reduce arrugas. Sin agujas ni recuperación.' },
    { nombre: 'Hifu 12D Buster', categoria: 'Hifu Facial', duracionMinutos: 30, precio: 64000, descripcion: 'Versión "flash" del Hifu 12D facial, mismo efecto lifting en formato más corto.' },

    // HIFU CORPORAL
    { nombre: 'Hifu corporal (Classic)', categoria: 'Hifu Corporal', duracionMinutos: 35, precio: 69000, descripcion: 'Zonas: cara interna de pierna, pantalón de montar, flancos, brazos, monte de venus, entre otras.' },
    { nombre: 'Hifu 10D corporal', categoria: 'Hifu Corporal', duracionMinutos: 35, precio: 79000, descripcion: 'Igual que el Classic, sumando rodilla y pliegue de corpiño entre las zonas tratables.' },
    { nombre: 'Hifu 12D corporal', categoria: 'Hifu Corporal', duracionMinutos: 30, precio: 84000, descripcion: 'Actúa en tejido graso y capas musculares: reduce grasa localizada, reafirma piel, moldea abdomen, brazos, muslos, glúteos o cintura.' },

    // LIPOSONIX / BODY SCULPT
    { nombre: 'Liposonix', categoria: 'Liposonix / Body Sculpt', duracionMinutos: 30, precio: 69000, descripcion: 'Ultrasonido focalizado de alta intensidad que destruye células de grasa. Zonas: abdomen, piernas, pantalón de montar, flancos, brazos, monte de venus, rodillas, pliegues del corpiño.' },
    { nombre: 'Liposonix 2x1 (2 sesiones)', categoria: 'Liposonix / Body Sculpt', duracionMinutos: 30, precio: 69000, descripcion: 'Promo del mes: 2 sesiones de Liposonix al precio de una.' },
    { nombre: 'Body Sculpt', categoria: 'Liposonix / Body Sculpt', duracionMinutos: 30, precio: 22900, descripcion: 'Define y tonifica zonas específicas, reduce grasa localizada, no invasivo, sin tiempo de inactividad.' },

    // DEPILACIÓN TITANIUM ICE TRIONDA
    { nombre: 'Depilación mujer - zona chica', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 15, precio: 15210, descripcion: 'Tecnología Soprano Titanium Ice de 3 ondas. Zonas: manos, pies, línea alba, bozo, mentón. Precio online (normal $16.900).' },
    { nombre: 'Depilación mujer - zona mediana', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 20, precio: 17010, descripcion: 'Precio online (normal $18.900).' },
    { nombre: 'Depilación mujer - zona grande', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 20, precio: 19710, descripcion: 'Precio online (normal $21.900).' },
    { nombre: 'Depilación mujer - medio cuerpo', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 20, precio: 22410, descripcion: 'Cavado completo + tira de cola + axilas. Precio online (normal $24.900).' },
    { nombre: 'Depilación mujer - cuerpo completo', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 30, precio: 24210, descripcion: 'Hasta 6 zonas (ej: bozo + mentón + axilas + cavado completo + tira de cola + pierna entera). Precio online (normal $26.900).' },
    { nombre: 'Depilación hombre - zona chica', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 15, precio: 15210, descripcion: 'Precio online (normal $16.900).' },
    { nombre: 'Depilación hombre - zona mediana', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 20, precio: 18810, descripcion: 'Precio online (normal $20.900).' },
    { nombre: 'Depilación hombre - zona grande', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 20, precio: 21510, descripcion: 'Precio online (normal $23.900).' },
    { nombre: 'Depilación hombre - medio cuerpo', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 20, precio: 24210, descripcion: 'Cavado completo + tira de cola + axilas. Precio online (normal $26.900).' },
    { nombre: 'Depilación hombre - cuerpo completo', categoria: 'Depilación Titanium Ice Trionda', duracionMinutos: 30, precio: 26010, descripcion: 'Hasta 6 zonas (ej: pecho + abdomen + cavado completo + tira de cola + axilas + piernas). Precio online (normal $28.900).' },

    // MASAJES Y OTROS SERVICIOS
    { nombre: 'Masaje reductor', categoria: 'Masajes y Otros Servicios', duracionMinutos: 50, precio: 32000, descripcion: 'Masaje corporal orientado a reducción de medidas.' },
    { nombre: 'Masaje descontracturante medio cuerpo unisex', categoria: 'Masajes y Otros Servicios', duracionMinutos: 50, precio: 34000, descripcion: 'Masaje descontracturante de medio cuerpo, para hombres y mujeres.' },
    { nombre: 'Masaje descontracturante cuerpo entero mujer', categoria: 'Masajes y Otros Servicios', duracionMinutos: 55, precio: 39000, descripcion: 'Masaje descontracturante de cuerpo completo, una hora.' },
    { nombre: 'Masaje relajante medio cuerpo unisex (pack x4)', categoria: 'Masajes y Otros Servicios', duracionMinutos: 50, precio: 100100, descripcion: 'Pack de 4 sesiones. Precio online (normal $110.000).' },
    { nombre: 'Masaje relajante cuerpo entero mujer', categoria: 'Masajes y Otros Servicios', duracionMinutos: 55, precio: 39000, descripcion: 'Masaje relajante de cuerpo completo.' },
    { nombre: 'Drenaje linfático', categoria: 'Masajes y Otros Servicios', duracionMinutos: 45, precio: 32000, descripcion: 'Drenaje linfático de cuerpo completo.' },
    { nombre: 'Presoterapia', categoria: 'Masajes y Otros Servicios', duracionMinutos: 30, precio: 19800, descripcion: 'Precio online (normal $22.000).' },

    // MEMBRESÍAS Y PASES
    { nombre: 'Membresía Facial (4 sesiones)', categoria: 'Membresías y Pases', duracionMinutos: 60, precio: 169000, descripcion: '2 sesiones de Hifu en rostro, cuello y escote + mantenimiento con puntas de diamante + dermaplaning. Resultados en 90 días.' },
    { nombre: 'Membresía Corporal (4 sesiones)', categoria: 'Membresías y Pases', duracionMinutos: 60, precio: 169000, descripcion: '4 sesiones de Hifu o Liposonix + Sculpt, para reafirmar y definir el cuerpo. Resultados en 90 días.' },
    { nombre: 'Membresía Full 1 (8 sesiones)', categoria: 'Membresías y Pases', duracionMinutos: 60, precio: 220000, descripcion: '2 Hifu corporal + 2 Liposonix + 8 Sculpt + 1 Hifu facial + 1 limpieza facial con puntas de diamante e hidratación.' },
    { nombre: 'Membresía Full 2 (10 sesiones)', categoria: 'Membresías y Pases', duracionMinutos: 60, precio: 280000, descripcion: '1 Hifu facial + 1 limpieza e hidratación facial + 2 Hifu corporal + 4 Liposonix + 16 Sculpt + 1 masaje a elección.' },
    { nombre: 'Membresía Full 3 (12 sesiones)', categoria: 'Membresías y Pases', duracionMinutos: 60, precio: 320000, descripcion: '4 Hifu corporal + 8 Liposonix + Sculpt libre + 2 Hifu facial + 2 limpieza facial + 4 masajes + 1 depilación cuerpo completo.' },
    { nombre: 'Pase Presoterapia x4', categoria: 'Membresías y Pases', duracionMinutos: 30, precio: 79900, descripcion: 'Pack de 4 sesiones de presoterapia.' },
    { nombre: 'Pase Masaje Drenaje x4', categoria: 'Membresías y Pases', duracionMinutos: 45, precio: 110000, descripcion: 'Pack de 4 sesiones de masajes reductores/drenaje.' },
    { nombre: 'Pase Masaje Cuerpo Entero Mujer x4', categoria: 'Membresías y Pases', duracionMinutos: 55, precio: 110000, descripcion: 'Pack de 4 sesiones, masaje descontracturante o relajante a elección.' },
    { nombre: 'Pase Body Sculpt x8', categoria: 'Membresías y Pases', duracionMinutos: 30, precio: 135000, descripcion: 'Pack de 8 sesiones de Body Sculpt.' },
    { nombre: 'Pase Body Sculpt x16', categoria: 'Membresías y Pases', duracionMinutos: 30, precio: 235000, descripcion: 'Pack de 16 sesiones de Body Sculpt.' },
  ],

  promociones: [
    {
      nombre: 'Liposonix 2x1',
      descripcion: '2 sesiones de Liposonix al precio de 1, para reducir centímetros y redefinir zonas localizadas sin cirugía.',
      vigenteHasta: '2026-07-31',
      condiciones: 'Promoción vigente solo por este mes.',
    },
  ],

  temasQueDerivanAHumano: [
    'quejas o reclamos',
    'consultas médicas o dermatológicas que requieran evaluación de una profesional',
    'reclamos sobre pagos ya realizados',
  ],
};
