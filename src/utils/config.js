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

  // WhatsApp Cloud API (API oficial de Meta) — ver SETUP.md
  waPhoneNumberId: required('WA_PHONE_NUMBER_ID'),
  waAccessToken: required('WA_ACCESS_TOKEN'),
  waAppSecret: required('WA_APP_SECRET'),
  waGraphVersion: process.env.WA_GRAPH_VERSION || 'v23.0',
  waTemplateLang: process.env.WA_TEMPLATE_LANG || 'es_AR',
  // Plantillas aprobadas en WhatsApp Manager (ver SETUP.md). Vacías = no se usan.
  waTemplates: {
    aviso: process.env.WA_TEMPLATE_AVISO || null,
    recordatorio: process.env.WA_TEMPLATE_RECORDATORIO || null,
    confirmacion: process.env.WA_TEMPLATE_CONFIRMACION || null,
    seguimiento: process.env.WA_TEMPLATE_SEGUIMIENTO || null,
  },

  webhookVerifyToken: required('WEBHOOK_VERIFY_TOKEN'),

  groqApiKey: process.env.GROQ_API_KEY || null,

  dashboardUser: required('DASHBOARD_USER'),
  dashboardPassword: required('DASHBOARD_PASSWORD'),
  receptionistPhone: process.env.RECEPTIONIST_PHONE || null,
  basePath: (process.env.BASE_PATH || '').replace(/\/+$/, ''),
  alertPhone: process.env.ALERT_PHONE || null,
};

module.exports = config;
