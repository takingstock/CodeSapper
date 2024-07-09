module.exports = {
    SERVER: {
      PORTS: {
        HAPI: 4002,
      },
      APP_NAME: 'IDP VisonEra-STAGE',
      API_TITLE: 'IDP VisonEra-STAGE API',
      API_DESCRIPTION: "Welcome to IDP VisonEra-trial <br><br><br><a href='/documentation'>Go To Documentation</a>",
      JWT_SECRET_KEY: 'gpRSrXgADcdkwJdTNuWSyPVfwr92FX',
      REDIS_KEY_PREFIX: 'trial',
    },
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/idp_vision_migrated_stage',
    OCR: {
      APIS: {
        HEALTH_OCR: 'http://20.219.34.135:7021/healthCheck',
        HEALTH_QR: 'http://20.219.34.135:6195/healthCheck',
        DOCUMENT_OCR: 'http://20.219.34.135:7021/processDocument',
        DOCUMENT_QR: 'http://20.219.34.135:6195/getQuickResponseCode',
        HEALTH_FEEDBACK: 'http://20.219.34.135:8551',
        NON_TABULAR_FEEDBACK: 'http://20.219.34.135:8601/processKeyValueFeedback',
        TABULAR_FEEDBACK: 'http://20.219.34.135:8611/processTableFeedback',
        DOCUMENT_SNIPPLET: 'http://20.219.34.135:7025/get_snippet_text',
        DOCUMENT_BUCKETING: 'http://20.219.34.135:8405/selectFeedbackFile',
        HEALTH_DOCUMENT_BUCKETING: 'http://20.219.34.135:8405',
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
