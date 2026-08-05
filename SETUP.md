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
