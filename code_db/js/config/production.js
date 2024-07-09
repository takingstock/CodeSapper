module.exports = {
  SERVER: {
    PORTS: {
      HAPI: 4003,
    },
  },
  JWT_SECRET_KEY: 'gpRSmYjCDhekjJkTNcWSIPVfwr92FX',
  REDIS_KEY_PREFIX: 'jkl',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/idp_vision_production',
  OCR: {
    APIS: {
      HEALTH_OCR: 'http://20.219.34.135:6193/healthCheck',
      HEALTH_QR: 'http://20.219.34.135:6196/healthCheck',
      DOCUMENT_OCR: 'http://20.219.34.135:6193/processDocument',
      DOCUMENT_QR: 'http://20.219.34.135:6196/getQuickResponseCode',
      HEALTH_FEEDBACK: 'http://20.219.34.135:8304',
      NON_TABULAR_FEEDBACK: 'http://20.219.34.135:8304/processKeyValueFeedback',
      TABULAR_FEEDBACK: 'http://20.219.34.135:8304/processTableFeedback',
      DOCUMENT_SNIPPLET: 'http://20.219.34.135:7003/get_snippet_text',
      DOCUMENT_BUCKETING: 'http://20.219.34.135:8308/selectFeedbackFile',
      HEALTH_DOCUMENT_BUCKETING: 'http://20.219.34.135:8308',
      UPDATE_FLAGS: 'http://20.219.34.135:7031/updateFlags'
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
