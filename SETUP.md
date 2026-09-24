# Setup de nuevo cliente — Wayudu

Checklist para poner en marcha el agente para un nuevo negocio.

## Requisitos previos

- [ ] VPS con Docker y Docker Compose instalados
- [ ] Dominio con HTTPS apuntando al VPS (Meta exige HTTPS para el webhook)
- [ ] App de Meta con WhatsApp configurado (ver "WhatsApp: API oficial de Meta" más abajo)
- [ ] Número de WhatsApp para el negocio que **no** esté en uso en la app de WhatsApp

## Pasos

### 1. Clonar el repo

```bash
git clone https://github.com/tiannocabo51-lgtm/recepcionista-ia-node.git /opt/agents/NOMBRE-CLIENTE
cd /opt/agents/NOMBRE-CLIENTE
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` y completar:

| Variable | Qué poner |
|---|---|
| `ANTHROPIC_API_KEY` | API key **propia del cliente** (cada cliente DEBE tener la suya) |
| `GROQ_API_KEY` | Key de Groq (gratis en console.groq.com) |
| `POSTGRES_PASSWORD` | Contraseña segura para la DB |
| `DATABASE_URL` | Actualizar con la misma contraseña |
| `WA_PHONE_NUMBER_ID` | Identificador del número en Meta |
| `WA_ACCESS_TOKEN` | Token permanente del usuario del sistema |
| `WA_APP_SECRET` | Clave secreta de la app de Meta |
| `WA_TEMPLATE_*` | Nombres de las plantillas aprobadas |
| `WEBHOOK_VERIFY_TOKEN` | Token inventado para verificar el webhook en Meta |
| `DASHBOARD_USER` | Usuario para acceder al dashboard |
| `DASHBOARD_PASSWORD` | Contraseña del dashboard |
| `RECEPTIONIST_PHONE` | WhatsApp del dueño/recepcionista (con código país, ej: 5492235551234) |
| `HOST_PORT` | Puerto externo (si hay varios agentes en el mismo VPS, usar puertos distintos) |
| `BASE_PATH` | Path del reverse proxy (ej: `/nombre-cliente`). Dejar vacío si no se usa Nginx. |

### 3. Configurar datos del negocio

```bash
cp businessConfig.example.js src/utils/businessConfig.js
```

Editar `src/utils/businessConfig.js` con los datos reales del cliente:
- Nombre del negocio y recepcionista virtual
- Descripción e Instagram
- Ubicación (dirección, ciudad, provincia, estacionamiento, referencia)
- Horarios de atención
- Formas de pago (con alias de transferencia/MP)
- Políticas (cancelación, llegada tarde, señas, menores, reembolsos, facturación)
- Configuración de agenda (duración mínima, gap entre turnos, confirmación automática/manual)
- Profesionales (nombre, rol, horario, servicios que atiende)
- Lista completa de servicios con categoría, duración, precio y descripción
- Promociones vigentes
- Combinaciones de servicios, contraindicaciones, frecuencia recomendada
- Preguntas frecuentes (la IA las responde automáticamente)
- Temas que derivan a humano
- Configuración de mensajes de la IA (saludo, despedida, tono, emojis, frases permitidas/prohibidas)
- Recordatorios (timing, cumpleaños, clientes inactivos)
- Preferencias de dashboard y marketing

### 4. Levantar con Docker

```bash
docker compose up -d --build
```

Verificar que arrancó bien:
```bash
docker compose logs -f app
```

### 5. Conectar el webhook en Meta

Seguí el paso 3 de "WhatsApp: API oficial de Meta" más abajo, con la URL
`https://tu-dominio.com/BASE_PATH/webhook`.

### 6. Probar

Mandar un mensaje de WhatsApp al número del cliente desde otro celular y verificar que el bot responde.

Probar también un audio para confirmar que la transcripción funciona.

### 7. Dashboard

Acceder al dashboard en `http://IP-VPS:HOST_PORT/dashboard` con las credenciales configuradas.

---

## Funcionalidades del sistema

### Core del agente

- **Prompt conversacional**: el system prompt está diseñado para que la IA suene como una persona real, no como un bot. Matchea el tono del cliente, mensajes cortos (2-3 líneas), sin frases robóticas. Se configura automáticamente con los datos de `businessConfig.js`.
- **Comprensión de audios**: transcribe audios de WhatsApp con Whisper vía Groq. Necesita `GROQ_API_KEY`. Sin ella, el bot pide que escriban por texto.
- **Rate limiting**: máximo 10 mensajes por minuto por teléfono en el webhook. Protege contra spam y ahorra costo de API.
- **Toggle IA/Humano**: desde el dashboard se puede desactivar la IA por chat para que responda un humano.
- **Contactos bloqueados**: se pueden bloquear contactos desde Ajustes en el dashboard. La IA no les responde. También se pueden cargar contactos iniciales en `businessConfig.js` > `contactosBloqueados`.

### Sistema anti-spam (conversationLock)

Módulo `src/services/conversationLock.js` — 7 capas de protección para que el agente nunca spamee:

- **Deduplicación por messageId**: cada mensaje de WhatsApp trae un ID único. Si ya se procesó, se ignora. Protege contra webhooks duplicados y reintentos de Meta. TTL de 5 minutos.
- **Filtro de mensajes antiguos**: si el `timestamp` del mensaje tiene más de 2 minutos de antigüedad, se descarta. Evita responder tarde a mensajes que Meta reintenta después de una caída.
- **Lock exclusivo por teléfono**: solo se procesa un mensaje a la vez por número. Si llega otro mientras se está procesando, se encola (máximo 1 en cola — el más reciente gana, el anterior se descarta). Elimina race conditions.
- **Anti-burst**: máximo 2 respuestas del bot en 30 segundos sin que el usuario haya vuelto a escribir. Después se frena automáticamente. Se resetea cuando el usuario escribe.
- **Control de saludo inteligente**: consulta la DB para saber cuándo fue el último mensaje del bot.
  - **Conversación nueva** → se presenta normalmente
  - **Más de 12 horas sin hablar** → re-saluda brevemente
  - **Conversación en curso** → NO se presenta, responde directo (regla inyectada al system prompt)
- **Reglas anti-spam en el system prompt**: se inyectan automáticamente instrucciones obligatorias: respuesta única, esperá al usuario, una pregunta por mensaje, máximo 4 líneas.
- **Follow-ups sin contaminar historial**: el sistema de seguimiento automático usa `{ isSystemFollowUp: true }` para que sus prompts internos no se guarden como mensajes del usuario en la DB.

### Servicios automáticos (arrancan solos)

- **Seguimiento automático de leads**: cada hora chequea leads estancados ("nuevo" o "consultando") y les manda un mensaje de seguimiento.
  - 1er seguimiento: a las 20hs sin respuesta (dentro de la ventana de 24hs, gratis)
  - 2do seguimiento: a las 72hs sin respuesta (necesita la plantilla `seguimiento`)
  - Máximo 2 seguimientos por lead, después no le escribe más
  - Solo manda en horario comercial (9 a 20hs, nunca domingos)
  - Notifica al dueño del negocio cada vez que manda un seguimiento
  - Si el lead responde, se resetea el contador automáticamente

- **Monitor de conexión**: chequea cada 5 minutos que el token y el número de WhatsApp sigan funcionando. Si fallan, manda alerta al `RECEPTIONIST_PHONE`. Cooldown de 30 min entre alertas. Banner offline visible en el dashboard.

- **Recordatorios de turnos**: envía recordatorio automático de turnos por WhatsApp. Timing configurable en `businessConfig.js` > `recordatorios.antesDeTurno`:
  - `'2h'` — 2 horas antes del turno (por defecto)
  - `'dia_anterior_noche'` — la noche anterior al turno
  - Incluye nombre del cliente, servicio, hora y dirección
  - 3 segundos de delay entre mensajes para evitar antispam

- **Limpieza automática**: los mensajes de conversación de más de 90 días se eliminan al iniciar la app.

### Dashboard — Páginas

- **Inicio**: resumen con métricas del día (turnos, ingresos, leads nuevos, tasa no-show), gráfico de ingresos semanal, countdown al próximo turno, acciones rápidas (nuevo turno, bloquear horario, ver leads).
- **Agenda**: vista interactiva con drag-drop de turnos, bloqueo de horarios, colores por estado, vista semana/día/mes/timeline. Multi-profesional (columnas separadas por profesional).
- **Leads**: tabla con todos los contactos, estados (nuevo → consultando → turno → cliente → inactivo), cambio de estado inline, tags personalizados por lead, toggle IA/Humano, exportar a CSV.
- **Conversaciones**: historial de chats con cada contacto, envío manual de mensajes.
- **Estadísticas**: resumen del mes (turnos, ingresos, servicios más pedidos, funnel de leads, tasa de cancelación, tasa no-show), comparación vs mes anterior con badges ↑↓%.
- **Ajustes**: toggle de conexión WhatsApp, gestión de contactos bloqueados, log de actividad del sistema.

### Dashboard — CRM

- **Notas por cliente**: agregar, ver y eliminar notas en cada lead. Panel dedicado en la vista de conversación.
- **Perfil de cliente**: panel con historial de turnos, total gastado, servicios más pedidos, tasa de no-show individual.
- **Tags personalizados**: etiquetar leads con tags libres (ej: "VIP", "primera vez", "sensible"). Se pueden agregar y eliminar desde la tabla de leads.
- **Log de actividad**: registra automáticamente acciones del dashboard (crear/cancelar/completar turnos, cambiar estado de leads, enviar mensajes, agregar tags). Visible en Ajustes.

### Dashboard — Exportación

- **Exportar leads a CSV**: botón "📥 CSV" en la página de Leads.
- **Exportar turnos por rango**: `GET /dashboard/api/appointments/export?from=2026-01-01&to=2026-01-31`.

### Infraestructura

- **API keys**: cada cliente DEBE tener su propia API key de Anthropic. No compartir entre clientes.
- **Rebuild**: después de editar código, siempre `docker compose build --no-cache app && docker compose up -d app` (no solo restart).
- **Migraciones automáticas**: al hacer `docker compose up`, la app detecta columnas y tablas faltantes y las agrega sola. No hace falta ejecutar SQL manualmente.
- **Nginx reverse proxy**: cada cliente se accede por path en el puerto 80: `http://IP-VPS/nombre-cliente/dashboard`. Config en `/etc/nginx/sites-available/wayudu`. Para agregar un cliente nuevo, agregar un bloque `location /nombre-cliente/` apuntando al puerto del cliente. Recordar setear `BASE_PATH=/nombre-cliente` en el `.env` del cliente.
- **`ALERT_PHONE`**: opcional en `.env`. Número para alertas de desconexión. Si no se configura, usa `RECEPTIONIST_PHONE`.

### Tablas de la DB (se crean automáticamente)

| Tabla | Para qué |
|---|---|
| `leads` | Contactos (nombre, teléfono, estado, seguimiento, toggle IA) |
| `appointments` | Turnos (fecha, servicio, precio, duración, color, profesional) |
| `conversations` | Mensajes de chat (teléfono, rol, contenido, timestamps) |
| `blocks` | Bloqueos de horario en la agenda |
| `client_notes` | Notas CRM por cliente |
| `lead_tags` | Tags personalizados por lead |
| `activity_log` | Log de actividad del dashboard |
| `whatsapp_windows` | Último mensaje de cada persona (ventana de 24hs de WhatsApp) |

---

## WhatsApp: API oficial de Meta (Cloud API)

El bot usa la API oficial de WhatsApp: no hay QR, no se desconecta y **no banean el número**
por usar un bot.

### Qué cuesta

- La API en sí y el hosting de Meta: **gratis**.
- Responder a quien te escribe (dentro de las 24hs de su último mensaje): **gratis**, sin límite.
- Si la persona entra desde un anuncio "clic a WhatsApp": **72hs gratis** para todo.
- Escribirle a alguien que no te escribió en las últimas 24hs: solo con **plantillas aprobadas**,
  que se cobran por mensaje según el tipo (utilidad o marketing) y el país. Son centavos de
  dólar; precios actualizados en
  https://developers.facebook.com/docs/whatsapp/pricing
- Para mandar plantillas pagas hay que cargar una tarjeta en el Business Manager.

### 1. Crear la app en Meta

1. Entrá a https://developers.facebook.com → **Mis apps → Crear app** → tipo **Empresa**,
   y elegí el portfolio comercial (Business Manager) del negocio.
2. Agregá el producto **WhatsApp**. Meta te da un número de prueba para testear gratis.
3. En **WhatsApp → Configuración de la API** agregá el número real del negocio y verificalo
   por SMS. Ese número **no puede estar en uso** en la app de WhatsApp: hay que borrar la
   cuenta de WhatsApp de ese número antes, o usar uno nuevo.
4. Copiá el **Identificador del número de teléfono** → `WA_PHONE_NUMBER_ID`.
5. Verificá la empresa en el Business Manager (sin verificar hay límites bajos de envío).

### 2. Token permanente

El token que aparece en la pantalla de la API dura 24hs. Para producción:

1. Business Manager → **Configuración del negocio → Usuarios del sistema → Agregar**
   (rol administrador).
2. **Asignar activos**: la app (control total) y la cuenta de WhatsApp.
3. **Generar token** con los permisos `whatsapp_business_messaging` y
   `whatsapp_business_management`, sin vencimiento → `WA_ACCESS_TOKEN`.
4. En la app: **Configuración de la app → Básica → Clave secreta** → `WA_APP_SECRET`.

### 3. Webhook

1. En la app: **WhatsApp → Configuración → Webhook → Editar**.
2. URL de devolución de llamada: `https://tu-dominio.com/webhook` (con `BASE_PATH` si usás
   Nginx). Tiene que ser HTTPS.
3. Token de verificación: el mismo valor que `WEBHOOK_VERIFY_TOKEN`.
4. Guardá (el bot tiene que estar corriendo) y suscribite al campo **messages**.

### 4. Plantillas

Se crean en **WhatsApp Manager → Plantillas de mensajes**, idioma **Español (ARG)**
(`es_AR`). Tardan de minutos a un par de horas en aprobarse. Los `{{n}}` tienen que ir en este
orden porque el bot los completa así:

| Variable `.env` | Nombre | Categoría | Texto |
|---|---|---|---|
| `WA_TEMPLATE_AVISO` | `aviso_interno` | Utilidad | Aviso del asistente de {{1}}: {{2}}. Entrá al panel para ver el detalle. |
| `WA_TEMPLATE_RECORDATORIO` | `recordatorio_turno` | Utilidad | Hola {{1}}, te recordamos tu turno de {{2}} hoy a las {{3}} en {{4}}. Si necesitás cancelar o reprogramar, respondé este mensaje. |
| `WA_TEMPLATE_CONFIRMACION` | `confirmacion_turno` | Utilidad | Hola {{1}}, ¿nos confirmás tu turno de {{2}} para mañana {{3}} a las {{4}}? Respondé este mensaje para confirmar o reprogramar. |
| `WA_TEMPLATE_SEGUIMIENTO` | `seguimiento` | Marketing | Hola {{1}}, ¿pudiste ver lo que charlamos? Si te quedó alguna duda sobre {{2}}, respondé este mensaje y te ayudamos. |

Cómo las usa el bot:

- Si la persona escribió en las últimas 24hs, manda texto normal (gratis) y la plantilla no se usa.
- Si no, manda la plantilla. Si esa plantilla no está configurada, no manda nada y lo deja en el log.
- Los avisos al dueño (derivaciones, turnos, alertas) usan `aviso_interno` salvo que el dueño le
  haya escrito al bot en las últimas 24hs.
- El primer seguimiento sale a las 20hs (dentro de la ventana, gratis). El segundo, a las 72hs,
  necesita la plantilla `seguimiento` (se cobra como marketing). Si la dejás vacía, no se manda.
- Desde el dashboard solo se puede responder a mano dentro de las 24hs.

### 5. Probar

Levantá el bot (`docker compose up -d --build`), mandale un WhatsApp al número y mirá
`docker compose logs -f app`. Con el número de prueba de Meta, primero agregá tu celular en
la lista de destinatarios permitidos de la pantalla de la API.
