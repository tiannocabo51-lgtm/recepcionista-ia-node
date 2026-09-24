# Recepcionista IA — Node.js + Claude + PostgreSQL + WhatsApp Cloud API

Agente de WhatsApp para una estética. Recibe mensajes vía webhook de la API oficial de
WhatsApp (Cloud API de Meta, ver `SETUP.md`),
responde con Claude (Anthropic) en español natural, detecta la intención de la persona
(pedir turno, precios, horarios, ubicación) y guarda los turnos en PostgreSQL.

## Estructura

```
recepcionista-ia-node/
├── Dockerfile
├── docker-compose.yml
├── db/init.sql              # se ejecuta solo al crear el contenedor de Postgres
├── .env.example
└── src/
    ├── index.js              # arranca el servidor Express
    ├── routes/
    │   ├── webhook.routes.js # POST /webhook
    │   └── health.routes.js  # GET /health
    ├── services/
    │   ├── claudeService.js      # orquesta la conversación con Claude + tools
    │   ├── whatsappService.js    # envío de mensajes, plantillas y ventana de 24hs
    │   ├── whatsapp/cloud.js     # llamadas a la WhatsApp Cloud API
    │   └── appointmentService.js # validación y guardado de turnos
    ├── db/
    │   ├── pool.js
    │   ├── appointments.repository.js
    │   ├── conversations.repository.js
    │   └── handoffs.repository.js
    └── utils/
        ├── config.js          # variables de entorno
        ├── businessConfig.js  # ← ÚNICO ARCHIVO A EDITAR por cliente/estética
        ├── systemPrompt.js    # arma el prompt que recibe Claude
        └── logger.js
```

## Cómo funciona

1. Meta manda un evento firmado a `POST /webhook` (el bot valida la firma con `WA_APP_SECRET`).
2. `whatsappService.parseIncomingMessage` extrae teléfono y texto (ignora mensajes propios,
   de grupos o sin texto).
3. `claudeService.handleMessage` carga el historial reciente de esa conversación desde
   PostgreSQL, arma el prompt del sistema con la info del negocio (`businessConfig.js`) y
   llama a Claude con dos tools disponibles:
   - `crear_turno`: cuando ya tiene nombre, servicio, fecha y hora, guarda el turno.
   - `derivar_recepcionista`: para quejas, temas médicos o cuando no logra entender a la
     persona — deja registro en la tabla `handoffs` y (si configuraste
     `RECEPTIONIST_PHONE`) le manda un WhatsApp a la recepcionista humana.
4. La respuesta final de Claude se guarda en `conversations` y se envía por WhatsApp con
   `whatsappService.sendMessage`.

No usa LangGraph ni ningún framework de agentes: es un loop simple de "llamar a Claude →
si pide una tool, ejecutarla → volver a llamar a Claude" (máximo 4 vueltas).

## Antes de arrancar

Editá **`src/utils/businessConfig.js`** con los datos reales de la estética: nombre,
ubicación, horarios, servicios y precios, promociones y motivos de derivación. Esa
información se le pasa completa a Claude en cada mensaje.

## Variables de entorno

Copiá `.env.example` a `.env` y completá:

- `ANTHROPIC_API_KEY`: tu clave de [console.anthropic.com](https://console.anthropic.com).
- `POSTGRES_*` / `DATABASE_URL`: credenciales de la base (las de `docker-compose.yml` ya
  están conectadas entre sí, solo cambiá la contraseña).
- `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`: datos de tu app de Meta.
- `WA_TEMPLATE_*`: nombres de las plantillas aprobadas (para escribir pasadas las 24hs).
- `WEBHOOK_VERIFY_TOKEN`: token propio (inventalo) que pegás en Meta al configurar el webhook.

Cómo conseguir cada uno: sección "WhatsApp: API oficial de Meta" de `SETUP.md`.
- `RECEPTIONIST_PHONE`: número de WhatsApp de la recepcionista humana para las
  derivaciones (opcional).

## Correr en local (sin Docker)

```bash
npm install
# necesitás un Postgres corriendo y las tablas de db/init.sql creadas
npm run dev
```

## Correr con Docker (recomendado para VPS)

```bash
cp .env.example .env
# completá el .env

docker compose up -d --build
```

Esto levanta Postgres (con las tablas creadas automáticamente la primera vez) y la app en
el puerto `3000`. Poné un proxy (Nginx/Caddy) con HTTPS delante para exponer `/webhook` a
Meta.

## Probar

```bash
curl http://localhost:3000/health

# Verificación del webhook (lo mismo que hace Meta al guardar la URL)
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=123"
```

Para probar mensajes de verdad usá el número de prueba que da Meta en la pantalla de la API.
Los `POST /webhook` sin la firma de Meta se rechazan con `401`.

## Notas de producción

- El webhook responde `200` inmediatamente y procesa el mensaje de forma asíncrona, para
  evitar que Meta reintente el envío por timeout.
- El historial de conversación se guarda por teléfono en la tabla `conversations` y se usa
  como contexto en cada mensaje nuevo (últimos 12 mensajes).
- Los turnos quedan en la tabla `appointments` con estado `pendiente` por default.
