/* eslint-disable eol-last */
const Joi = require('joi');

Joi.objectId = require('joi-objectid')(Joi);

// config payload schema
const MAPPING_PAYLOAD_OBJECT = {
  isUserDefined: Joi.boolean().default(false).optional(),
  isDefaultDoc: Joi.boolean().default(false).optional(),
  isTablePresent: Joi.boolean().default(false).optional(),
  docCategory: Joi.string().valid('GOVT', 'INVOICE', 'INSURANCE', 'HEALTHCARE', 'SALARY', 'TRANSACTION_STATEMENT', 'OTHER').required(),
  documentType: Joi.string().optional(),
  columns: Joi.array().items(Joi.string()).default([]).optional(),
  mapping: Joi.array().items({
    key: Joi.string().required(),
    dataType: Joi.string().valid('string', 'number', 'alphanumeric', 'date').required(),
    isRequired: Joi.boolean().default(false).optional(),
  }).required(),
};

const IMC_GLOBAL_MAPPING_PAYLOAD_UPDATE_SCHEMA = {
  json: Joi.array().items(MAPPING_PAYLOAD_OBJECT),
  tenantIds: Joi.array().items(Joi.objectId()).min(1).optional(),
};

const IMC_OCR_UPDATE_URL_SCHEMA = {
  url: Joi.string().required(),
};
const IMC_USER_UPDATE_SCHEMA = {
  status: Joi.boolean().optional(),
  expiryInDays: Joi.number().integer().min(1).max(365)
    .optional(),
};
module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  IMC_GLOBAL_MAPPING_PAYLOAD_UPDATE_SCHEMA,
  IMC_OCR_UPDATE_URL_SCHEMA,
  IMC_USER_UPDATE_SCHEMA
};
