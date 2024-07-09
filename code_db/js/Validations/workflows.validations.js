const Joi = require('joi');
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

Joi.objectId = require('joi-objectid')(Joi);

const _VARIABLE_SCHEMA = Joi.array().items({
  componentId: Joi.string().optional().allow('', null).default(null),
  componentName: Joi.string().optional().allow('', null).default(null),
  docId: Joi.objectId().optional().default(null).allow(null),
  documentType: Joi.string().optional().default(null).allow(null),
  variables: Joi.array().items(Joi.object({
    key: Joi.string().required(),
    exportKey: Joi.string().optional(),
    selected: Joi.boolean().required(),
  })).optional(),
  columns: Joi.array().optional().default([])
}).optional().default([]);

const _VARIABLE_INFLOW_SCHEMA = Joi.object({
  ocr: _VARIABLE_SCHEMA,
  derived: _VARIABLE_SCHEMA,
  qr: _VARIABLE_SCHEMA,
}).default({});

const _docIdsArray = Joi.array().items(Joi.object({
  docId: Joi.objectId().required(),
  docType: Joi.string().required(),
}));

// workflow create schema
const WORKFLOW_CREATE_PAYLOAD_SCHEMA = Joi.object({
  name: Joi.string().required(),
  country: Joi.string().required(),
  primaryDocId: Joi.objectId().required(),
  docIds: _docIdsArray.required().min(1),
  variablesInFlow: _VARIABLE_INFLOW_SCHEMA.optional(),
  inputJSON: Joi.any().optional(),
});

// workflow update schema
const WORKFLOW_UPDATE_PAYLOAD_SCHEMA = Joi.object({
  name: Joi.string().optional(),
  country: Joi.string().optional(),
  docIds: _docIdsArray.required(),
  primaryDocId: Joi.objectId().required(),
  variablesInFlow: _VARIABLE_INFLOW_SCHEMA.required(),
  frontendJSON: Joi.any().required(),
  outputJSON: Joi.any().optional(),
  inputJSON: Joi.any().optional(),
  published: Joi.boolean().optional().default(false)
});

// workflow update schema
const WORKFLOW_VALIDATE_PAYLOAD_SCHEMA = Joi.object({
  name: Joi.string().optional(),
  country: Joi.string().optional(),
  docIds: _docIdsArray.required(),
  primaryDocId: Joi.objectId().required(),
  variablesInFlow: _VARIABLE_INFLOW_SCHEMA.required(),
  frontendJSON: Joi.any().required(),
  outputJSON: Joi.any().optional(),
  inputJSON: Joi.any().optional(),
});

const WORKFLOW_PROCESS_PAYLOAD_SCHEMA = Joi.object({
  batchId: Joi.objectId().required(),
  workflowId: Joi.objectId().required(),
});

// workflows search schema
const WORKFLOW_SEARCH_SCHEMA = Joi.object({
  isPublished: Joi.boolean().optional().default(null),
  fields: Joi.string().optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'workflow').optional(),
  workflowType: Joi.string().valid('default', 'custom', 'static').optional()
}).concat(SEARCH_COMMON_SCHEMA);

module.exports = {
  WORKFLOW_CREATE_PAYLOAD_SCHEMA,
  WORKFLOW_UPDATE_PAYLOAD_SCHEMA,
  WORKFLOW_VALIDATE_PAYLOAD_SCHEMA,
  WORKFLOW_SEARCH_SCHEMA,
  WORKFLOW_PROCESS_PAYLOAD_SCHEMA,
};
