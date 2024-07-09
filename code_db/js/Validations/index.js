const appConfig = require('./app-config.validations');
const auth = require('./auth.validations');
const user = require('./user.validations');
const credentails = require('./credentails.validations');
const document = require('./document.validations');
const globalMapping = require('./global-mapping.validations');
const idp = require('./idp.validations');
const imc = require('./imc.validations');
const stats = require('./stats.validations');
const training = require('./training.validations');
const workflows = require('./workflows.validations');
const ocr = require('./ocr.validations');
const aiServer = require('./aiServer.validations');
const enterpriseValidations = require('./enterpriseUser.validation');
const teamsValidations = require('./teams.validation');
const dBLogs = require('./debugLogs.validations')
const queueLogs = require('./queueLogs.validations')

module.exports = {
  ...appConfig,
  ...auth,
  ...user,
  ...credentails,
  ...document,
  ...globalMapping,
  ...idp,
  ...imc,
  ...stats,
  ...training,
  ...workflows,
  ...ocr,
  ...aiServer,
  ...enterpriseValidations,
  ...teamsValidations,
  ...dBLogs,
  ...queueLogs
};
