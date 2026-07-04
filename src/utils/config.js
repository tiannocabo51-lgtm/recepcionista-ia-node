require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisá tu archivo .env`);
  }
  return value;
}

const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  anthropicApiKey: required('ANTHROPIC_API_KEY'),
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-5',
  claudeMaxTokens: Number(process.env.CLAUDE_MAX_TOKENS) || 1024,

  databaseUrl: required('DATABASE_URL'),

  evolutionApiUrl: required('EVOLUTION_API_URL').replace(/\/+$/, ''),
  evolutionApiKey: required('EVOLUTION_API_KEY'),
  evolutionInstance: required('EVOLUTION_INSTANCE'),

  webhookVerifyToken: process.env.WEBHOOK_VERIFY_TOKEN || null,

  dashboardUser: required('DASHBOARD_USER'),
  dashboardPassword: required('DASHBOARD_PASSWORD'),
  receptionistPhone: process.env.RECEPTIONIST_PHONE || null,
};

module.exports = config;
