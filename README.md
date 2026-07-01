# Recepcionista IA — Node.js + Claude + PostgreSQL + Evolution API

Agente de WhatsApp para una estética. Recibe mensajes vía webhook de Evolution API,
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
    │   ├── whatsappService.js    # envío/parseo de mensajes vía Evolution API
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

1. Evolution API manda un evento (`messages.upsert`) a `POST /webhook`.
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
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`: datos de tu instancia de
  Evolution API. En el panel de Evolution, configurá el webhook de la instancia apuntando a
  `https://tu-dominio.com/webhook?token=EL_MISMO_VALOR_QUE_WEBHOOK_VERIFY_TOKEN`.
- `WEBHOOK_VERIFY_TOKEN`: token propio (inventalo) para que nadie más pueda pegarle a tu
  webhook. Si lo dejás vacío, no se valida (no recomendado en producción).
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
Evolution API.

## Probar

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "key": { "remoteJid": "5492235551234@s.whatsapp.net", "fromMe": false },
      "message": { "conversation": "Hola, quiero saber los precios" }
    }
  }'
```

Si no tenés Evolution API a mano todavía, revisá los logs del contenedor (`docker compose
logs -f app`): vas a ver el intento de respuesta y, si falla el envío por WhatsApp (porque
no hay instancia real), el error queda logueado pero el turno/consulta igual se procesa
contra Claude y PostgreSQL.

## Notas de producción

- El webhook responde `200` inmediatamente y procesa el mensaje de forma asíncrona, para
  evitar que Evolution API reintente el envío por timeout.
- El historial de conversación se guarda por teléfono en la tabla `conversations` y se usa
  como contexto en cada mensaje nuevo (últimos 12 mensajes).
- Los turnos quedan en la tabla `appointments` con estado `pendiente` por default.
