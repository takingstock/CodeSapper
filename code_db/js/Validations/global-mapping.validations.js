/* eslint-disable eol-last */
/* eslint-disable comma-dangle */
const Joi = require('joi');
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

// config query schema
const MAPPING_QUERY_SCHEMA = {
  documentType: Joi.string().required(),
};
const VALUE_SHEMA = {
  key: Joi.string().min(3).required(),
  exportKey: Joi.string().optional(),
  dataType: Joi.string().valid('string', 'number', 'alphanumeric', 'date').required(),
  isRequired: Joi.boolean().default(false).optional(),
  description: Joi.string().optional(),
  threshHoldConfidenceScore: Joi.number().min(0).max(100)
}
// config payload schema
const MAPPING_PAYLOAD_SCHEMA = {
  isUserDefined: Joi.boolean().default(false).optional(),
  isTablePresent: Joi.boolean().default(false).optional(),
  docCategory: Joi.string().valid('GOVT', 'INVOICE', 'INSURANCE', 'HEALTHCARE', 'SALARY', 'TRANSACTION_STATEMENT', 'OTHER').required(),
  documentType: Joi.string().required(),
  // columns: Joi.array().items(Joi.string()).optional(), // TODO remove
  columns: Joi.array().items(VALUE_SHEMA).optional(), // TODO UNCOMMENT
  mapping: Joi.array().items(VALUE_SHEMA).min(4).required(),
  importedFrom: Joi.string().optional(),
  tenantId: Joi.objectId().optional()
};

const SEARCH_SCHEMA_OCR_LOCAL = Joi.object({
  q: Joi.string().optional().allow(''),
  orderBy: Joi.string().valid('ASC', 'DESC').optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'docType').optional(),
});

// serach schema
const SEARCH_SCHEMA_OCR = SEARCH_SCHEMA_OCR_LOCAL.concat(Joi.object({
  tenantId: Joi.objectId().required(),
  docId: Joi.objectId().optional(),
  docType: Joi.string().optional(),
  docCategory: Joi.string().valid('GOVT', 'INVOICE', 'INSURANCE', 'HEALTHCARE', 'SALARY', 'TRANSACTION_STATEMENT', 'OTHER').optional(),
}));

// serach schema
const SEARCH_SCHEMA_GLOBAL_MAPPING = SEARCH_SCHEMA_OCR_LOCAL
  .concat(SEARCH_COMMON_SCHEMA)
  .concat(Joi.object({
    docType: Joi.string().optional(),
    docCategory: Joi.string().valid('GOVT', 'INVOICE', 'INSURANCE', 'HEALTHCARE', 'SALARY', 'TRANSACTION_STATEMENT', 'OTHER').optional(),
    mappingType: Joi.string().valid('default', 'custom', 'static').optional(),
    description: Joi.string().optional(),
    dateDisplayType: Joi.string().optional(),
    tenantId: Joi.objectId().optional()
  }));

// config payload schema
const MAPPING_PAYLOAD_UPDATE_SCHEMA = {
  isTablePresent: Joi.boolean().default(false).optional(),
  docCategory: Joi.string().valid('GOVT', 'INVOICE', 'INSURANCE', 'HEALTHCARE', 'SALARY', 'TRANSACTION_STATEMENT', 'OTHER').optional(),
  documentType: Joi.string().optional(),
  // columns: Joi.array().items(Joi.string()).optional(), // TODO REMOVE
  columns: Joi.array().items(VALUE_SHEMA).optional(), // TODO UNCOMMENT
  mapping: Joi.array().items(VALUE_SHEMA).min(4).required(),
  tenantId: Joi.objectId().optional()
};

module.exports = {
  MAPPING_QUERY_SCHEMA,
  MAPPING_PAYLOAD_SCHEMA,
  MAPPING_PAYLOAD_UPDATE_SCHEMA,
  SEARCH_SCHEMA_OCR,
  SEARCH_SCHEMA_GLOBAL_MAPPING,
};
