const Joi = require('joi');

const CREDENTIALS_PAYLOAD_SCHEMA = Joi.object({
  zoho_table: Joi.object({
    accountEmailId: Joi.string().required(),
    workSpace: Joi.string().required(),
    tableName: Joi.string().required(),
    clientId: Joi.string().required(),
    clientSecret: Joi.string().required(),
    code: Joi.string().required(),
    refreshToken: Joi.string().required(),
  }).optional().default(null),
});

// document query search schema
const CREDENTIALS_SEARCH_SCHEMA = Joi.object({
  cred_type: Joi.string().valid('zoho_table').required(),
  tenantId: Joi.objectId().required(),
});

module.exports = {
  CREDENTIALS_PAYLOAD_SCHEMA,
  CREDENTIALS_SEARCH_SCHEMA,
};
