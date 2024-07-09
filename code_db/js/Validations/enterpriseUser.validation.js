const Joi = require('joi');
const config = require('config');
// const { joiController } = require('../Controllers');

const ERR_MESSAGES = config.get('ERR_MESSAGES');

Joi.objectId = require('joi-objectid')(Joi);

// user schema
const ENTERPRISE_USER_SCHEMA = Joi.object({
    firstName: Joi.string().min(2).max(50).required()
    .description("Enter the firstName"),
    lastName: Joi.string().min(2).max(50).optional()
    .description("Enter the lastName"),
        email: Joi.string().email().required()
        .description(ERR_MESSAGES.VALID_EMAIL),
        password: Joi.string().required(),
        roleId: Joi.objectId().required(),
        teamName: Joi.string().optional(), ///
        superVisorIds: Joi.array().optional() ///
});

const ENTERPRISE_USER_GET_SCHEMA = Joi.object({
    _id: Joi.string().optional(),
    roleId: Joi.string().optional(),
    email: Joi.string().optional(),
    pageNo: Joi.number().default(1).min(1).optional(),
    limit: Joi.number().default(10).optional(),
    isDefault: Joi.boolean().optional()
});
// user update schema
const USER_UPDATE_SCHEMA = Joi.object({
    // _id: Joi.string().required(),
    firstName: Joi.string().optional(),
    lastName: Joi.string().optional(),
    email: Joi.string().email().optional().description(ERR_MESSAGES.VALID_EMAIL),
    // name: Joi.string().min(2).max(50).optional()
    //   .description(ERR_MESSAGES.VALID_USER_NAME),
    // roleId: Joi.objectId().optional(),
    // roleName: Joi.string().required().allow('SUPERVISOR', 'INDEXERS'),
    password: Joi.string().optional(),
    superVisorIds: Joi.array().optional(),
    teamName: Joi.string().optional(),
    // expiryInDays: Joi.number().integer().min(1).max(365)
    //   .optional(),
    // isTrialAccountSuspended: Joi.boolean().optional(),
  });
  //  id schema
  const ID_SCHEMA = Joi.object({
    id: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),
  });

  const DELETE_USER = Joi.object({
    id: Joi.objectId().required(),
    // roleName: Joi.string().required().allow('SUPERVISOR', 'INDEXERS'),
    newSuperVisorId: Joi.string().optional()
  })
module.exports = {
    ENTERPRISE_USER_SCHEMA,
    ENTERPRISE_USER_GET_SCHEMA,
    USER_UPDATE_SCHEMA,
    ID_SCHEMA,
    DELETE_USER
};
