const userController = require('./user.controller');
const adminUserController = require('./user-admin.controller');
const authController = require('./auth.controller');
const roleController = require('./role.controller');
const rateLimitingController = require('./rate-limiting-controller');
const configController = require('./app-config.controller');
const joiController = require('./joi.controller');
const idpController = require('./idp.controller');
const uploadController = require('./upload.controller');
const ocrAiController = require('./ocr-ai.controller');
const mappingController = require('./mapping.controller');
const documentController = require('./document.controller');
const docOutputController = require('./doc-output.controller');
const globalMappingController = require('./global-mapping.controller');
const trainingController = require('./training.controller');
const feedbackAiController = require('./feedback-ai.controller');
const logController = require('./log.controller');
const statsController = require('./stats.controller');
const healthController = require('./health.controller');
const credentialController = require('./credential.controller');
const workflowsController = require('./workflows.controller');
const decisionTreeController = require('./decission-tree.controller');
const imcController = require('./imc.controller');
const syncAiResponseController = require('./syncAiResponse.controller');
const processOcrController = require('./process-ocr.controller')
const idpKeyController = require('./idp-key.controller')
const ocrLogsController = require('./ocr-logs.controller')
const settingController = require('./setting-controller')
const aiServerController = require('./ai-server.controller')
const adminDashboardController = require('./admin-dashboard.controller')
const webhookController = require('./webhook.controller')
const externalDbConfigController = require('./external-db-config.controller')
const inputStorageController = require("./input-storage.controller")
const vendorsController = require("./vendors.controller")
const bolVendorsController = require("./bolVendors.controller")
const dashboardReportController = require("./dashboard-report.controller")
const vendorsAiController = require("./vendor-ai-controller")
const enterpriseAdminController = require("./enterpriseAdmin.controller")
const teamsController = require("./teams.controller");
const reportsController = require("./reports.controller");
const debugController = require("./debugLogs.controller");
const queueController = require("./queueController");
const aiController = require("./aiController");

module.exports = {
  userController,
  adminUserController,
  rateLimitingController,
  authController,
  roleController,
  configController,
  joiController,
  idpController,
  uploadController,
  ocrAiController,
  mappingController,
  documentController,
  docOutputController,
  globalMappingController,
  trainingController,
  feedbackAiController,
  logController,
  statsController,
  healthController,
  credentialController,
  workflowsController,
  decisionTreeController,
  imcController,
  syncAiResponseController,
  processOcrController,
  idpKeyController,
  ocrLogsController,
  settingController,
  aiServerController,
  adminDashboardController,
  webhookController,
  externalDbConfigController,
  inputStorageController,
  vendorsController,
  dashboardReportController,
  vendorsAiController,
  enterpriseAdminController,
  teamsController,
  reportsController,
  debugController,
  bolVendorsController,
  queueController,
  aiController
};
