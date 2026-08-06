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
- Nombre del negocio
- Nombre de la recepcionista virtual
- Descripción
- Instagram
- Ubicación y link de Maps
- Horarios de atención
- Formas de pago
- Políticas (cancelación, llegada tarde, primera vez)
- Lista completa de servicios con precios
- Promociones vigentes

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

## Notas

- **API keys**: cada cliente DEBE tener su propia API key de Anthropic. No compartir entre clientes.
- **Rebuild**: después de editar código, siempre `docker compose up -d --build app` (no solo restart).
- **Audios**: necesitan GROQ_API_KEY configurada. Sin ella, el bot pide que escriban por texto.
- **Toggle IA/Humano**: desde el dashboard se puede desactivar la IA por chat para que responda un humano.
- **Seguimiento automático de leads**: viene activado por defecto. Cada hora chequea leads estancados (estado "nuevo" o "consultando") y les manda un mensaje de seguimiento:
  - 1er seguimiento: a las 24hs sin respuesta
  - 2do seguimiento: a las 72hs sin respuesta
  - Máximo 2 seguimientos por lead, después no le escribe más
  - Solo manda en horario comercial (9 a 20hs, nunca domingos)
  - Notifica al dueño del negocio cada vez que manda un seguimiento
  - Si el lead responde, se resetea el contador automáticamente
- **Monitor de conexión**: chequea cada 5 minutos si WhatsApp sigue conectado. Si se desconecta, manda un mensaje de alerta al número configurado en `RECEPTIONIST_PHONE`. Cooldown de 30 min entre alertas para no spamear. Es silencioso mientras todo ande bien.
- **Prompt conversacional**: el system prompt está diseñado para que la IA suene como una persona real, no como un bot. Matchea el tono del cliente, mensajes cortos (2-3 líneas), sin frases robóticas. Se configura automáticamente con los datos de `businessConfig.js`.
- **Nginx reverse proxy**: cada cliente se accede por path en el puerto 80: `http://IP-VPS/nombre-cliente/dashboard`. Config en `/etc/nginx/sites-available/wayudu`. Para agregar un cliente nuevo, agregar un bloque `location /nombre-cliente/` apuntando al puerto del cliente. Recordar setear `BASE_PATH=/nombre-cliente` en el `.env` del cliente.
- **Contactos bloqueados**: para clientes que usan WhatsApp personal/laboral, se pueden bloquear contactos desde Ajustes en el dashboard. La IA no les responde. También se pueden cargar contactos iniciales en `businessConfig.js` > `contactosBloqueados`.
- **Agenda interactiva**: el dashboard tiene una agenda completa con drag-drop de turnos, bloqueo de horarios, colores por estado, vista semana/día/mes/timeline. Las migraciones de la DB se ejecutan automáticamente al arrancar la app (no hace falta tocar la DB).
- **Migraciones automáticas**: al hacer `docker compose up`, la app detecta columnas y tablas faltantes y las agrega sola. No hace falta ejecutar SQL manualmente.
