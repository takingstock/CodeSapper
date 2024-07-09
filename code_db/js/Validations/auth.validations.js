const Joi = require('joi');
const config = require('config');
const { password } = require('./common.schema');

const ERR_MESSAGES = config.get('ERR_MESSAGES');

// login schema
const LOGIN_SCHEMA = Joi.object({
  email: Joi.string().email().required().description(ERR_MESSAGES.VALID_EMAIL),
  password,
  randomNumber: Joi.string().min(4).required(),
  uniqueId: Joi.string().min(5).required()
});

// login schema
const REGISTER_SCHEMA = Joi.object({
  phoneNumber: Joi.string().optional(),
  region: Joi.string().optional(),
  lastName: Joi.string().optional(),
  companyName: Joi.string().optional(),
  jobTitle: Joi.string().optional(),
  firstName: Joi.string().required(),
  emailId: Joi.string().email().required().description(ERR_MESSAGES.VALID_EMAIL),
  expiryInDays: Joi.number().optional(),
  privacyConsent: Joi.boolean().optional(),
  useCase: Joi.string().optional(),
  otp: Joi.string().optional()
});

// login schema
const FORGOT_SCHEMA = Joi.object({
  email: Joi.string().email().required().description(ERR_MESSAGES.VALID_EMAIL),
});

// login schema
const CHANGE_PASSWORD_SCHEMA = Joi.object({
  token: Joi.string().optional(),
  password
});
module.exports = {
  LOGIN_SCHEMA,
  FORGOT_SCHEMA,
  REGISTER_SCHEMA,
  CHANGE_PASSWORD_SCHEMA
};
