const Joi = require('joi');
const config = require('config');
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

Joi.objectId = require('joi-objectid')(Joi);

const OUTPUT_EXTENSIONS = config.get('OUTPUT_EXTENSIONS');
const ERR_MESSAGES = config.get('ERR_MESSAGES');
const UPLOAD_INPUT_KEY = config.get('UPLOAD_INPUT_KEY');

// idp payload schema
const IDP_PAYLOAD_UPLOAD_SCHEMA = Joi.object({
  configId: Joi.objectId().optional(),
  workflowId: Joi.objectId().optional(),
  [UPLOAD_INPUT_KEY]: Joi.any()
    .meta({ swaggerType: 'file' })
    .required()
    .description(ERR_MESSAGES.IDP_SELECT_UPLOAD),
});

// idp query schema
const IDP_QUERY_UPLOAD = Joi.object().keys({
  output: Joi.string().valid(
    OUTPUT_EXTENSIONS.CSV,
    OUTPUT_EXTENSIONS.JSON,
    OUTPUT_EXTENSIONS.BATCH,
  ).optional(),
}).optional();

// idp query search schema
const IDP_SEARCH_SCHEMA = Joi.object({
  fields: Joi.string().optional(),
  workflowId: Joi.objectId().optional(),
  idpId: Joi.objectId().optional(),
  uploadedVia: Joi.string().optional()
}).concat(SEARCH_COMMON_SCHEMA);
// idp download schema
const IDP_DOWNLOAD_LINK = Joi.object({
  batchId: Joi.objectId().required(),
  exportedFromUpload: Joi.boolean().optional(),
});
// batchId schema
const BATCH_ID_SCHEMA = Joi.object({
  batchId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),
});
const PAYLOAD_START_QC = Joi.object({
  batchId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),
  qcCurrentDocument: Joi.objectId().optional().description(ERR_MESSAGES.VALID_OBJECTID),
  qcStatus: Joi.string().valid('STARTED', 'STOPPED', 'COMPLETED').default('STARTED').optional(),
  qcThresholdPercent: Joi.number().optional()
})
const FETCH_DATA_FOR_AI = Joi.object({
  criteria: Joi.object().unknown().required(),
  tableName: Joi.string().allow('documentService', 'VendorsService', 'appConfigService', 'credentialService',
    'globalMappingService', 'idpService', 'rateLimitingService', 'roleService', 'tenantService',
    'trainingFeedbackService', 'trainingService', 'workflowLogService', 'workflowService', 'addressIdsService',
    'reportsListService', 'customersService', 'teamsService', 'pageService').required(),
  projection: Joi.string().optional(),
  method: Joi.string().optional(),
  options: Joi.object().unknown().required()
})

const COUNT_DATA_FOR_AI = Joi.object({
  criteria: Joi.object().required(),
  tableName: Joi.string().allow('documentService', 'VendorsService', 'appConfigService', 'credentialService',
    'globalMappingService', 'idpService', 'rateLimitingService', 'roleService', 'tenantService',
    'trainingFeedbackService', 'trainingService', 'workflowLogService', 'workflowService', 'addressIdsService',
    'reportsListService', 'customersService', 'teamsService', 'pageService').required(),
})
module.exports = {
  IDP_PAYLOAD_UPLOAD_SCHEMA,
  IDP_QUERY_UPLOAD,
  IDP_SEARCH_SCHEMA,
  IDP_DOWNLOAD_LINK,
  BATCH_ID_SCHEMA,
  PAYLOAD_START_QC,
  FETCH_DATA_FOR_AI,
  COUNT_DATA_FOR_AI
};
