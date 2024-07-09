const Joi = require('joi');
const config = require('config');
// import { joiController } from '../controllers';
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

const SUPPORTED_DOCS = config.get('DOCS');
const CONFIG_TYPES = config.get('CONFIG_TYPE');

// config query schema
const CONFIG_QUERY_SCHEMA = {
  type: Joi.string().valid(
    CONFIG_TYPES.INPUT_SOURCE,
    CONFIG_TYPES.UPLOAD,
    CONFIG_TYPES.API_CALL,
    CONFIG_TYPES.EMAIL,
    CONFIG_TYPES.UPLOAD,
    CONFIG_TYPES.S3_BUCKET,
    CONFIG_TYPES.WHATSAPP,
    CONFIG_TYPES.GOOGLE_DRIVE,
  ).required(),
};

// config payload schema
const CONFIG_PAYLOAD_SCHEMA = {
  country: Joi.string().required(),
  name: Joi.string().required(),
  inputType: Joi.string().valid(
    CONFIG_TYPES.INPUT_SOURCE,
    CONFIG_TYPES.UPLOAD,
    CONFIG_TYPES.API_CALL,
    CONFIG_TYPES.EMAIL,
    CONFIG_TYPES.UPLOAD,
    CONFIG_TYPES.S3_BUCKET,
    CONFIG_TYPES.WHATSAPP,
    CONFIG_TYPES.GOOGLE_DRIVE,
  ).required(),
  outputType: Joi.string().valid('csv', 'api').optional(),
  upload: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    aliases: Joi.array().items({
      key: Joi.string().required(),
      alias: Joi.string().required(),
    }),
  })).optional(),
  // verification
  verification: Joi.array().items(Joi.object({
    type: Joi.string()
      .valid(SUPPORTED_DOCS.PAN, SUPPORTED_DOCS.AADHAAR, SUPPORTED_DOCS.RC).required(),
    apiSlug: Joi.string().required(),
    fields: Joi.array().items(Joi.string()).required(),
  })).optional(),
  // platform setting
  platform: Joi.object({
    ipAddress: Joi.string().required(),
    userAgent: Joi.string().required(),
  }).optional(),
  // api setting as output
  outputApi: Joi.object().keys({
    name: Joi.string().required(),
    api_url: Joi.string().required(),
    method: Joi.string().required(),
    bearer_token: Joi.string().optional(),
    sample_response: Joi.string().required(),
    json_path: Joi.string().required(),
    error_message: Joi.string().required(),
    success_message: Joi.string().required(),
    input_values: Joi.array().items({
      key: Joi.string().required(),
      value: Joi.string().required(),
      type: Joi.string().valid(
        'PAYLOAD_OPTIONAL',
        'PAYLOAD',
        'QUERY',
        'QUERY_OPTIONAL',
        'URL_PARAM',
        'HEADER',
      ).required(),
    }).optional(),
  }).optional(),
};

const RULE_ENGINE_PAYLOAD_SCHEMA = Joi.object({
  rules: Joi.array()
    .items({
      name: Joi.string().required(),
      conditions: Joi.array()
        .items({
          docType: Joi.string().required(),
          key: Joi.string().required(),
          operator: Joi.string().optional(),
        }).required(),
    }).required(),
});

// document query search schema
const CONFIG_SEARCH_SCHEMA = Joi.object({
  fields: Joi.string().optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name').optional(),
}).concat(SEARCH_COMMON_SCHEMA);

module.exports = {
  CONFIG_SEARCH_SCHEMA,
  CONFIG_QUERY_SCHEMA,
  CONFIG_PAYLOAD_SCHEMA,
  RULE_ENGINE_PAYLOAD_SCHEMA,
};
