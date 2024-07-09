module.exports = {
  SERVER: {
    PORTS: {
      HAPI: 4009,
    },
    APP_NAME: 'IDP VisonEra-v1',
    API_TITLE: 'IDP scalar API',
    API_DESCRIPTION: "Welcome to IDP VisonEra-scalar <br><br><br>",
    JWT_SECRET_KEY: 'gpRSrXgADcdkwJdTNuWSyPVfwr92FX',
    REDIS_KEY_PREFIX: 'idpvisionscalar',
  },
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/idp_vision_scalar',
  OCR: {
    APIS: {
      HEALTH_OCR: 'http://20.219.34.135:7035/healthCheck',
      HEALTH_QR: 'http://20.219.34.135:6198/healthCheck',
      DOCUMENT_OCR: 'http://20.219.34.135:7035/processDocument',
      DOCUMENT_QR: 'http://20.219.34.135:6198/getQuickResponseCode',
      HEALTH_FEEDBACK: 'http://20.219.34.135:8302',
      NON_TABULAR_FEEDBACK: 'http://20.219.34.135:8302/processKeyValueFeedback',
      TABULAR_FEEDBACK: 'http://20.219.34.135:8603/processTableFeedback',
      DOCUMENT_SNIPPLET: 'http://20.219.60.8:8100/get_snippet_text',
      DOCUMENT_BUCKETING: 'http://20.219.34.135:8306/selectFeedbackFile',
      HEALTH_DOCUMENT_BUCKETING: 'http://20.219.34.135:8306',
      UPDATE_FLAGS: 'http://20.219.34.135:7031/updateFlags',
      VENDOR_CORRECTION: 'http://3.7.164.112:8013/vendorCorrection'
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
}
