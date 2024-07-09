module.exports = {
  // MONGODB_URI: 'mongodb+srv://techyaura:techyaura@quorastack.ag2q9.mongodb.net/myFirstDatabase?retryWrites=true&w=majority',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/db_idb_visionera',
  OCR: {
    APIS: {
      HEALTH_OCR: 'http://20.219.34.135:6191/healthCheck',
      HEALTH_QR: 'http://20.219.34.135:6197/healthCheck',
      DOCUMENT_OCR: 'http://20.219.34.135:6191/processDocument',
      DOCUMENT_QR: 'http://20.219.34.135:6197/getQuickResponseCode',
      HEALTH_FEEDBACK: 'http://20.219.34.135:8303',
      NON_TABULAR_FEEDBACK: 'http://20.219.34.135:8303/processKeyValueFeedback',
      TABULAR_FEEDBACK: 'http://20.219.34.135:8303/processTableFeedback',
      DOCUMENT_SNIPPLET: 'http://20.219.34.135:7001/get_snippet_text',
      DOCUMENT_BUCKETING: 'http://20.219.34.135:8307/selectFeedbackFile',
      HEALTH_DOCUMENT_BUCKETING: 'http://20.219.34.135:8307',
    },
  },
  HOST: {
    development: 'http://0.0.0.0:3669/',
  },
  WORKFLOWS_DEFAULT: [
    {
      country: 'india',
      name: 'GOVT IDS - Workflow',
      inputType: 'UPLOAD',
    },
    {
      country: 'india',
      name: 'Invoice - Workflow',
      inputType: 'UPLOAD',
    },
    {
      country: 'india',
      name: 'Invoice And QR - Workflow',
      inputType: 'UPLOAD',
    },
    {
      country: 'india',
      name: 'QR Documents - Workflow',
      inputType: 'UPLOAD',
    },
  ],
  IMC: {
    SMS_SENT_PERMISSION: false,
  },
  SERVER: {
    CRON_DELAY_TIME: 5000, // milliseconds,
  },
};
