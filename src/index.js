const express = require('express');
const config = require('./utils/config');
const logger = require('./utils/logger');
const healthRoutes = require('./routes/health.routes');
const webhookRoutes = require('./routes/webhook.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // CORS: only allow same-origin by default
  const origin = req.headers.origin;
  if (origin && config.basePath) {
    // Allow requests from the same host (nginx reverse proxy)
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

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

const followUpService = require('./services/followUpService');
const connectionMonitor = require('./services/connectionMonitor');
const blockedContacts = require('./db/blockedContacts.repository');
const { runMigrations } = require('./db/migrate');

const server = app.listen(config.port, () => {
  logger.info(`Servidor escuchando en el puerto ${config.port} (${config.nodeEnv})`);
  logger.info(`Webhook: POST http://localhost:${config.port}/webhook`);
  logger.info(`Health check: GET http://localhost:${config.port}/health`);
  runMigrations();
  followUpService.start();
  connectionMonitor.start();
  blockedContacts.loadCache();
});

const pool = require('./db/pool');

function shutdown(signal) {
  logger.info(`Recibida señal ${signal}, cerrando servidor...`);
  server.close(() => {
    pool.end().then(() => {
      logger.info('Pool de base de datos cerrado');
      process.exit(0);
    }).catch(() => process.exit(0));
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
