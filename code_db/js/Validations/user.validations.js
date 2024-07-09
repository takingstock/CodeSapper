const Joi = require('joi');
const config = require('config');
const { password, SEARCH_COMMON_SCHEMA } = require('./common.schema');
const { joiController } = require('../Controllers');

const ERR_MESSAGES = config.get('ERR_MESSAGES');

Joi.objectId = require('joi-objectid')(Joi);

// admin user schema
// Team Name - Default Team Name
const ADMIN_USER_SCHEMA = Joi.object({
  email: Joi.string().email().required().external(joiController.checkUniqueEmail)
    .description(ERR_MESSAGES.VALID_EMAIL),
  name: Joi.string().min(2).max(50).required()
    .description(ERR_MESSAGES.VALID_USER_NAME),
  tenant: Joi.string().min(2).max(30).external(joiController.checkUniqueTenant)
    .optional(),
  roleId: Joi.objectId().optional(),
});

// admin update schema
const ADMIN_USER_UPDATE_SCHEMA = Joi.object({
  email: Joi.string().email().optional().description(ERR_MESSAGES.VALID_EMAIL),
  name: Joi.string().min(2).max(50).optional()
    .description(ERR_MESSAGES.VALID_USER_NAME),
  roleId: Joi.objectId().optional(),
  status: Joi.boolean().optional(),
  isTrialAccount: Joi.boolean().optional(),
  isTrialAccountSuspended: Joi.boolean().optional(),
  expiryInDays: Joi.number().integer().min(1).max(365)
    .optional(),
  password: Joi.string().min(6).max(50).optional()
    .description('Invalid password'),
  extendStorage: Joi.number().integer().min(1).max(25000)
    .optional(),
  trialRequest: Joi.string().valid('PENDING', 'ACCEPTED', 'REJECTED').optional(),
  quotaRequest: Joi.string().valid('PENDING', 'ACCEPTED', 'REJECTED').optional()
});

//  profile schema
const PROFILE_SCHEMA = Joi.object({
  email: Joi.string().email().required()
    .description(ERR_MESSAGES.VALID_EMAIL),
  name: Joi.string().min(2).max(50).required()
    .description(ERR_MESSAGES.VALID_USER_NAME),
});

// user schema
const USER_SCHEMA = Joi.object({
  email: Joi.string().email().required().external(joiController.checkUniqueEmail)
    .description(ERR_MESSAGES.VALID_EMAIL),
  name: Joi.string().min(2).max(50).required()
    .description(ERR_MESSAGES.VALID_USER_NAME),
  roleId: Joi.objectId().required(),
});

// user update schema
const USER_UPDATE_SCHEMA = Joi.object({
  email: Joi.string().email().optional().description(ERR_MESSAGES.VALID_EMAIL),
  name: Joi.string().min(2).max(50).optional()
    .description(ERR_MESSAGES.VALID_USER_NAME),
  roleId: Joi.objectId().optional(),
  expiryInDays: Joi.number().integer().min(1).max(365)
    .optional(),
  isTrialAccountSuspended: Joi.boolean().optional(),
});

// password schema
const PASSWORD_SCHEMA = Joi.object({
  password,
});

// id schema
const ID_SCHEMA = Joi.object({
  id: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),
});

// id schema
const TRIAL_EXTEND_SCHEMA = Joi.object({
  expiryInDays: Joi.number().integer().min(1).max(30)
    .required(),
});

// extension scheme
const EXTEND_REQUEST_SCHEMA = Joi.object({
  quota: Joi.boolean().optional(),
  trial: Joi.boolean().optional(),
  email: Joi.string().email().required().external(joiController.emailExists)
    .description(ERR_MESSAGES.VALID_EMAIL)
});
// search schema
const SEARCH_SCHEMA = SEARCH_COMMON_SCHEMA;

// search users from admin panel
const SEARCH_ADMIN_SCHEMA = Joi.object({
  status: Joi.boolean().optional(),
  isTrialAccount: Joi.boolean().optional(),
  isTrialAccountSuspended: Joi.boolean().optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'trialEndDate', 'firstLoginDate', 'lastLoginDate').optional(),
  trialRequest: Joi.string().valid('PENDING', 'ACCEPTED', 'REJECTED').optional(),
  quotaRequest: Joi.string().valid('PENDING', 'ACCEPTED', 'REJECTED').optional()
}).concat(SEARCH_SCHEMA);
const TENANT_ID_SCHEMA = Joi.object({
  tenantId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),
})
module.exports = {
  USER_SCHEMA,
  USER_UPDATE_SCHEMA,
  PASSWORD_SCHEMA,
  SEARCH_SCHEMA,
  ID_SCHEMA,
  PROFILE_SCHEMA,
  ADMIN_USER_SCHEMA,
  ADMIN_USER_UPDATE_SCHEMA,
  TRIAL_EXTEND_SCHEMA,
  SEARCH_ADMIN_SCHEMA,
  TENANT_ID_SCHEMA,
  EXTEND_REQUEST_SCHEMA
};
