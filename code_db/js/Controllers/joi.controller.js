const config = require('config');
const {
  userService, tenantService, globalMappingService, appConfigService,
} = require('../Services');

const ERR_MESSAGES = config.get('ERR_MESSAGES');

/**
 * check uniqueEmail
 * @param {String} email
 */
const checkUniqueEmail = async (email) => {
  const result = await userService.findOne({ email }, { email: 1 });
  if (result) {
    throw new Error(ERR_MESSAGES.EMAIL_ALREADY_EXIST);
  }
};

/**
 * check tenant
 * @param {String} tenantName
 */
const checkUniqueTenant = async (tenantName) => {
  const result = await tenantService.findOne({ name: tenantName }, { name: 1 });
  if (result) {
    throw new Error(ERR_MESSAGES.TENANT_ALREADY_EXIST);
  }
};

/**
 * check config
 * @param {String} name
 */
const checkUniqueConfig = async (name) => {
  const result = await appConfigService.findOne({ name }, { name: 1 });
  if (result) {
    throw new Error(ERR_MESSAGES.CONFIG_ALREADY_EXIST);
  }
};

/**
 * check documentType
 * @param {String} documentType
 */
const checkUniqueMappingDocument = async (documentType) => {
  const result = await globalMappingService
    .findOne({ documentType: { $regex: documentType, $options: 'i' }, isDeleted: false }, { documentType: 1 });
  if (result) {
    throw new Error(ERR_MESSAGES.DOCUMENT_TYPE_ALREADY_EXIST);
  }
};

/**
 * check email exists
 * @param {String} email
 */
const emailExists = async (email) => {
  const result = await userService.findOne({ email }, { email: 1 });
  if (!result) {
    throw new Error("Email Doesn't exists");
  }
};

module.exports = {
  emailExists,
  checkUniqueEmail,
  checkUniqueTenant,
  checkUniqueConfig,
  checkUniqueMappingDocument,
};
