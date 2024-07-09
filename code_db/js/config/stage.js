module.exports = {
  SERVER: {
    PORTS: {
      HAPI: 4007,
    },
    APP_NAME: 'IDP VisonEra-STAGE',
    API_TITLE: 'IDP VisonEra-STAGE API',
    API_DESCRIPTION: "Welcome to IDP VisonEra-Trial <br><br><br><a href='/documentation'>Go To Documentation</a>",
    JWT_SECRET_KEY: 'gpRSrXgADcdkwJdTNuWSyPVfwr92FX',
    REDIS_KEY_PREFIX: 'stage',
  },
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/idp_vision_stage',
  OCR: {
    APIS: {
      HEALTH_OCR: 'http://20.219.34.135:6192/healthCheck',
      HEALTH_QR: 'http://20.219.34.135:6195/healthCheck',
      DOCUMENT_OCR: 'http://20.219.34.135:6192/processDocument',
      DOCUMENT_QR: 'http://20.219.34.135:6195/getQuickResponseCode',
      HEALTH_FEEDBACK: 'http://20.219.34.135:8301',
      NON_TABULAR_FEEDBACK: 'http://20.219.34.135:8301/processKeyValueFeedback',
      TABULAR_FEEDBACK: 'http://20.219.34.135:8602/processTableFeedback',
      DOCUMENT_SNIPPLET: 'http://20.219.34.135:8100/get_snippet_text',
      DOCUMENT_BUCKETING: 'http://20.219.34.135:8505/selectFeedbackFile',
      HEALTH_DOCUMENT_BUCKETING: 'http://20.219.34.135:8305',
      UPDATE_FLAGS: 'http://20.219.34.135:45654/updateFlags'
    },
  },
  WORKFLOWS_DEFAULT: [
    {
      country: 'india',
      name: 'All Documents',
      inputType: 'UPLOAD',
    },
    {
      country: 'india',
      name: 'KYC Documents',
      inputType: 'UPLOAD',
    },
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
