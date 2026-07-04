const express = require('express');
const config = require('./utils/config');
const logger = require('./utils/logger');
const healthRoutes = require('./routes/health.routes');
const webhookRoutes = require('./routes/webhook.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.use(express.json({ limit: '2mb' }));

app.use(healthRoutes);
app.use(webhookRoutes);
app.use(dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({ status: 'not_found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({ status: 'error' });
});

const server = app.listen(config.port, () => {
  logger.info(`Servidor escuchando en el puerto ${config.port} (${config.nodeEnv})`);
  logger.info(`Webhook: POST http://localhost:${config.port}/webhook`);
  logger.info(`Health check: GET http://localhost:${config.port}/health`);
});

function shutdown(signal) {
  logger.info(`Recibida señal ${signal}, cerrando servidor...`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
