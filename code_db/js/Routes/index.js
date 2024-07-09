// v2 routes
const config = require('config');

const userRoutes = require('./v1/user.routes');
const aiRoutes = require('./v1/AI.routes');
const adminUserRoutes = require('./v1/user-admin.routes');
const authRoutes = require('./v1/auth.routes');
const roleRoutes = require('./v1/role.routes');
const configRoutes = require('./v1/app-config.routes');
const idpRoutes = require('./v1/idp.routes');
const staticRoutes = require('./v1/static-resources.routes');
const documentRoutes = require('./v1/document.routes');
const ruleEngineRoutes = require('./v1/rule-engine.routes');
const globalMappingRoutes = require('./v1/global-mapping.routes');
const trainingRoutes = require('./v1/training.routes');
const logRoutes = require('./v1/log.routes');
const statsRoutes = require('./v1/stats.routes');
const healthRoutes = require('./v1/health.routes');
const credentailRoutes = require('./v1/credential.routes');
const imcRoutes = require('./v1/imc-routes');

const workkflowRoutes = require('./v2/workkflow.routes');
const ocrRoutes = require('./v2/ocr.routes');
const logs = require('./v2/logs.route');
const idpKey = require('./v2/idp-key.route')
const setting = require('./v2/setting.routes')
const aiServerRoutes = require('./v2/ai-server-routes')
const adminDashboardRoutes = require('./v2/admin-dashboard-routes')
const webhookRoutes = require("./v2/webhook-routes")
const externalDbRoutes = require("./v2/external-db-config-routes")
const inputStorageRoutes = require("./v2/input-storage.routes")
const vendorsRoutes = require("./v2/vendors-routes")
const bolVendorsRoutes = require("./v2/bol-vendors-routes")
const serverStatusRoutes = require("./v2/ai-ocr-server-routes")
const dashboardRoutes = require("./v2/dashboard-routes")
const vendorsAiRoutes = require("./v2/vendor-ai-routes")
const enterpriseAdminRoutes = require('./v2/enterpriseAdmin.route')
const teamsRoutes = require('./v2/teams.route')
const captchaRoutes = require('./v1/captcha.routes')
const reportsRoutes = require('./v2/reports-routes')
const envConfigRoutes = require('./v2/env-config-routes')
const dbRoutes = require('./v2/debugLogs.routes')
const queueRoutes = require('./v2/queueLogs.routes')
// const gmailSetupRoutes = require('./v2/gmail-setup.routes')
const backupDocumentRoutes = require('./v2/backup-document.routes')
const latestTeamsRoutes = require('./v2/latest-teams.routes')
const latestEnterpriseUserRoutes = require('./v2/latest-enterprise-user.routes')
const enterpriseAdminDashboardRoutes = require('./v2/enterprise-admin-dashboard-routes')

const serverConfig = config.get('SERVER');
const ocrConfig = config.get('OCR');

const routes = [
  ...aiRoutes,
  ...userRoutes,
  ...authRoutes,
  ...roleRoutes,
  ...adminUserRoutes,
  ...configRoutes,
  ...idpRoutes,
  ...staticRoutes,
  ...documentRoutes,
  ...ruleEngineRoutes,
  ...globalMappingRoutes,
  ...trainingRoutes,
  ...logRoutes,
  ...statsRoutes,
  ...healthRoutes,
  ...credentailRoutes,
  ...imcRoutes,
  ...workkflowRoutes,
  ...ocrRoutes,
  ...logs,
  ...idpKey,
  ...setting,
  ...aiServerRoutes,
  ...adminDashboardRoutes,
  ...webhookRoutes,
  ...externalDbRoutes,
  ...inputStorageRoutes,
  ...vendorsRoutes,
  ...serverStatusRoutes,
  ...dashboardRoutes,
  ...vendorsAiRoutes,
  ...enterpriseAdminRoutes,
  ...teamsRoutes,
  ...captchaRoutes,
  ...reportsRoutes,
  ...envConfigRoutes,
  ...dbRoutes,
  ...bolVendorsRoutes,
  ...queueRoutes,
  ...backupDocumentRoutes,
  ...latestTeamsRoutes,
  ...latestEnterpriseUserRoutes,
  ...enterpriseAdminDashboardRoutes
];
if (process.env.SWAGGER_OPEN_API === 'limited') {
  routes.forEach(e => {
    if (e && e.options && e.options.tags && e.options.tags[0] !== 'External APIs') {
      e.options.tags = []
    }
  });
}
// default route for server
routes.push({
  method: 'GET',
  path: '/',
  handler() {
    return serverConfig.API_DESCRIPTION;
  },
});
routes.push({
  method: 'GET',
  path: '/aiDetail',
  handler() {
    return ocrConfig.APIS;
  },

})
module.exports = routes;
