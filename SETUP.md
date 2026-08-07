# Setup de nuevo cliente — Wayudu

Checklist para poner en marcha el agente para un nuevo negocio.

## Requisitos previos

- [ ] VPS con Docker y Docker Compose instalados
- [ ] Evolution API corriendo (con instancia creada para el cliente)
- [ ] Número de WhatsApp del cliente (celular dedicado para el negocio)

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
| `EVOLUTION_API_URL` | URL de la Evolution API |
| `EVOLUTION_API_KEY` | API key de la instancia Evolution |
| `EVOLUTION_INSTANCE` | Nombre de la instancia de WhatsApp |
| `WEBHOOK_VERIFY_TOKEN` | Token inventado para validar webhooks |
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

### 5. Vincular WhatsApp

1. Abrir en el navegador: `http://IP-VPS:PUERTO-EVOLUTION/manager`
2. En la instancia del cliente, generar QR
3. Escanear el QR desde el celular del cliente (WhatsApp > Dispositivos vinculados > Vincular)
4. Esperar a que diga "connected"

### 6. Configurar webhook en Evolution API

En la config de la instancia en Evolution, agregar webhook:
- URL: `http://NOMBRE-CONTAINER:3000/webhook?token=TU-TOKEN`
- Eventos: `MESSAGES_UPSERT`

### 7. Probar

Mandar un mensaje de WhatsApp al número del cliente desde otro celular y verificar que el bot responde.

Probar también un audio para confirmar que la transcripción funciona.

### 8. Dashboard

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

- **Deduplicación por messageId**: cada webhook de Evolution API trae un ID único. Si ya se procesó, se ignora. Protege contra webhooks duplicados, retries y sync histórico al reconectar WhatsApp. TTL de 5 minutos.
- **Filtro de mensajes antiguos**: si el `messageTimestamp` del webhook tiene más de 2 minutos de antigüedad, se descarta. Evita que al reconectar WhatsApp se procesen mensajes históricos como nuevos.
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
  - 1er seguimiento: a las 24hs sin respuesta
  - 2do seguimiento: a las 72hs sin respuesta
  - Máximo 2 seguimientos por lead, después no le escribe más
  - Solo manda en horario comercial (9 a 20hs, nunca domingos)
  - Notifica al dueño del negocio cada vez que manda un seguimiento
  - Si el lead responde, se resetea el contador automáticamente

- **Monitor de conexión**: chequea cada 5 minutos si WhatsApp sigue conectado. Si se desconecta, manda alerta al `RECEPTIONIST_PHONE`. Cooldown de 30 min entre alertas. Banner offline visible en el dashboard.

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
