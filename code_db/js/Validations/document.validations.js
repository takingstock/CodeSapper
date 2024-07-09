const Joi = require('joi');
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

Joi.objectId = require('joi-objectid')(Joi);

// document assign schema
const DOCUMENT_ASSIGN_SCHEMA = Joi.object({
  documentIds: Joi.array().items(Joi.objectId()).min(1).required(),
  accounts: Joi.array().items(Joi.string()).min(1).required(),
  description: Joi.string().allow('').optional(),
});

// document update schema
const DOCUMENT_UPDATE_SCHEMA = Joi.object({
  isFinalized: Joi.boolean().optional().default(false),
  pageId: Joi.number().optional(),
  docType: Joi.string().optional(),
  fieldArray: Joi.array().items(Joi.object({
    fieldId: Joi.string().required().allow(''),
    fieldValue: Joi.string().required().allow(''),
    global_key: Joi.string().required().allow(''),
    pts: Joi.array().items(Joi.number()).optional(),
    qc_error_type: Joi.string().optional().valid("CHARACTER", "VALUE", "DUPLICATE", "NONE"),
    updatedPageNo: Joi.number().optional()
  })).optional(),
  tables: Joi.array().items(Joi.object({
    pageId: Joi.objectId().required(),
    tabularContent: Joi.array().items(Joi.object().unknown(true))
  })).optional(),
  status: Joi.string().valid('ASSIGNED', 'IN_REVIEW', 'PENDING', 'COMPLETED', 'UPLOADED', 'HOLD').optional(),
  reason: Joi.string().optional(),
  qcFromSupervisorScreen: Joi.boolean().optional(),
  header_table: Joi.string().optional()
});

// document snipplet
const DOCUMENT_SNIPPLET_SCHEMA = Joi.object({
  s3_url: Joi.string().required(),
  x1: Joi.number().required(),
  y1: Joi.number().required(),
  x2: Joi.number().required(),
  y2: Joi.number().required(),
  ocr_json: Joi.string().optional()
});

// multiple ObjectIds payload schema
const MULTIPLE_OBJECT_ID_SCHEMA = {
  recordIds: Joi.array().items(Joi.objectId()).min(1).required(),
};

// document query search schema
const DOCUMENT_SEARCH_SCHEMA = Joi.object({
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'docType', 'fileOriginalName').optional(),
  isAssigned: Joi.boolean().optional().default(false),
  status: Joi.string().optional(),
  score: Joi.string().optional(),
  configId: Joi.objectId().optional(),
  batchId: Joi.objectId().optional(),
  isIdentified: Joi.boolean().optional(),
  isNonIdentified: Joi.boolean().optional(),
  isFeedbackApplied: Joi.boolean().optional(),
  corruptFiles: Joi.boolean().optional().default(false),
  trainingSet: Joi.boolean().optional().default(false),
  bucketId: Joi.string().optional(),
}).concat(SEARCH_COMMON_SCHEMA);

// docRetrieveMapping
const DOC_MAPPING_DOWNLOAD_SCHEMA = Joi.object({
  type: Joi.string().valid('json', 'csv').required(),
  batchId: Joi.objectId().optional().required(),
  docIds: Joi.array().items(Joi.objectId()).optional(),
  filter: Joi.object({
    // isAssigned: Joi.boolean().optional().default(false),
    isFeedbackApplied: Joi.boolean().optional(),
    isIdentified: Joi.boolean().optional(),
    status: Joi.string().optional(),
    score: Joi.string().optional(),
  }),
});

const IMC_DOCUMENT_SEARCH_SCHEMA = Joi.object({
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'docType').optional(),
  batchId: Joi.objectId().required(),
  tenantId: Joi.objectId().optional(),
  allFields: Joi.boolean().optional()
}).concat(SEARCH_COMMON_SCHEMA);
const DOCUMENT_QC_SCHEMA = Joi.object({
  tableFlag: Joi.boolean().optional(),
  nonTableFlag: Joi.boolean().optional(),
  ocrOutputLink: Joi.string().optional()
})
module.exports = {
  DOCUMENT_UPDATE_SCHEMA,
  DOCUMENT_ASSIGN_SCHEMA,
  MULTIPLE_OBJECT_ID_SCHEMA,
  DOCUMENT_SEARCH_SCHEMA,
  DOCUMENT_SNIPPLET_SCHEMA,
  DOC_MAPPING_DOWNLOAD_SCHEMA,
  IMC_DOCUMENT_SEARCH_SCHEMA,
  DOCUMENT_QC_SCHEMA
};
