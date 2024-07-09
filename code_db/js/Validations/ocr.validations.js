const Joi = require('joi');
const config = require('config');
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

Joi.objectId = require('joi-objectid')(Joi);

const ERR_MESSAGES = config.get('ERR_MESSAGES');
const UPLOAD_INPUT_KEY = config.get('UPLOAD_INPUT_KEY');

// ocr payload schema
const OCR_PAYLOAD_UPLOAD_SCHEMA = Joi.object({
  workflowId: Joi.objectId().optional(),
  docType: Joi.string().optional(),
  tableHeaders: Joi.array().items(Joi.string()).optional(),
  [UPLOAD_INPUT_KEY]: Joi.any()
    .meta({ swaggerType: 'file' })
    .required()
    .description(ERR_MESSAGES.IDP_SELECT_UPLOAD),
});

// ocr query schema
const OCR_QUERY_UPLOAD = Joi.object().keys({
  customer_id: Joi.string().required(),
}).optional();

// ocr query search for logs schema
const OCR_SEARCH_SCHEMA = Joi.object({
  fields: Joi.string().optional(),
  workflowId: Joi.objectId().optional(),
  ipAddress: Joi.string().optional(),
  uploadedFrom: Joi.date().optional(),
  uploadedTo: Joi.date().optional(),
  statusCode: Joi.string().optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'apiResolveTime').optional(),
}).concat(SEARCH_COMMON_SCHEMA);

// ocr documents payload schema
const OCR_QUERY_DOCUMENT_LIST = Joi.object({
  apiBatch: Joi.string().optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'docType', 'fileOriginalName').optional(),
  isAssigned: Joi.boolean().optional().default(false),
  status: Joi.string().optional(),
  score: Joi.string().optional(),
  configId: Joi.objectId().optional(),
  isIdentified: Joi.boolean().optional(),
  isNonIdentified: Joi.boolean().optional(),
  isFeedbackApplied: Joi.boolean().optional(),
  bucketId: Joi.string().optional(),
  corruptFiles: Joi.boolean().optional()
}).concat(SEARCH_COMMON_SCHEMA);

// ocr  document payload schema
const OCR_QUERY_DOCUMENT_DETAIL = Joi.object({
  apiBatch: Joi.string().optional()
});

// ocr Batch creation payload schema
const OCR_PAYLOAD_BATCH_VARIFY = Joi.object({
  from: Joi.date(),
  to: Joi.date(),
  batchName: Joi.string().optional()
});
// oct batch cration
const OCR_PAYLOAD_BATCH_CREATION = Joi.object({
  workflowId: Joi.objectId().optional()
}).concat(OCR_PAYLOAD_BATCH_VARIFY);
// ocr batchs payload schema
const OCR_QUERY_BATCH_LIST = Joi.object({
  apiBatch: Joi.objectId().optional()
}).concat(SEARCH_COMMON_SCHEMA);

const OCR_PAYLOAD_KEY_DATA_UPDATE = Joi.object({
  ipAddress: Joi.array().items(Joi.string()).optional()
});

const OCR_PAYLOAD_KEY_DATA_DELETE = Joi.object({
  ipAddress: Joi.string().optional()
});

module.exports = {
  OCR_PAYLOAD_UPLOAD_SCHEMA,
  OCR_QUERY_UPLOAD,
  OCR_SEARCH_SCHEMA,
  OCR_QUERY_DOCUMENT_LIST,
  OCR_QUERY_DOCUMENT_DETAIL,
  OCR_PAYLOAD_BATCH_CREATION,
  OCR_QUERY_BATCH_LIST,
  OCR_PAYLOAD_KEY_DATA_UPDATE,
  OCR_PAYLOAD_KEY_DATA_DELETE,
  OCR_PAYLOAD_BATCH_VARIFY
};
