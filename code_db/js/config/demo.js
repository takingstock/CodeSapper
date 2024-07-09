module.exports = {
  SERVER: {
    PORTS: {
      HAPI: 4000,
    },
    APP_NAME: 'IDP VisonEra-MIGRATED_DEMO',
    API_TITLE: 'IDP VisonEra-MIGRATED_DEMO API',
    API_DESCRIPTION: "Welcome to IDP VisonEra-MigratedDemo <br><br><br><a href='/documentation'>Go To Documentation</a>",
    JWT_SECRET_KEY: 'gpRSrXgBEnqwejJfTNvWCyOVfwr92FX',
    REDIS_KEY_PREFIX: 'ghi',
  },
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/idp_vision_migrated_prod_demo',
  OCR: {
    APIS: {
      HEALTH_OCR: 'http://20.219.34.135:6191/healthCheck',
      HEALTH_QR: 'http://20.219.34.135:6197/healthCheck',
      DOCUMENT_OCR: 'http://20.219.34.135:6191/processDocument',
      DOCUMENT_QR: 'http://20.219.34.135:6197/getQuickResponseCode',
      HEALTH_FEEDBACK: 'http://20.219.34.135:8303',
      NON_TABULAR_FEEDBACK: 'http://20.219.34.135:8303/processKeyValueFeedback',
      TABULAR_FEEDBACK: 'http://20.219.34.135:8303/processTableFeedback',
      DOCUMENT_SNIPPLET: 'http://20.219.34.135:7003/get_snippet_text',
      DOCUMENT_BUCKETING: 'http://20.219.34.135:8307/selectFeedbackFile',
      HEALTH_DOCUMENT_BUCKETING: 'http://20.219.34.135:8307',
    },
  },
  WORKFLOWS_DEFAULT: [
    {
      country: 'india',
      name: 'Invoices',
      inputType: 'UPLOAD',
    },
    {
      country: 'india',
      name: 'Onboarding Forms',
      inputType: 'UPLOAD',
    },
  ],
};
