const AppConfig = require('./app-config.model');
const Credentail = require('./credentials.model');
const Document = require('./document.model');
const GlobalMapping = require('./global-mapping.model');
const Idp = require('./idp.model');
const RateLimit = require('./rate-limiting.model');
const Role = require('./role.model');
const Tenant = require('./tenant.model');
const TrainingFeedback = require('./training-feedback.model');
const Training = require('./training.model');
const User = require('./user.model');
const WorkflowLog = require('./workflow-log.model');
const Workflow = require('./workflow.model');
const Logs = require('./logs.model');
const Idpkey = require('./idp-key.model')
const IdpInfo = require('./idp-info.model');
const TenantSetting = require('./tenant-setting.model');
const AiServer = require('./ai-server-model')
const WebHook = require('./webhook.model')
const DbConfig = require('./external-db-config.model')
const InputStorage = require('./input-storage-model')
const VendorAI = require('./vendorAI.model')
const Teams = require('./teamsSchema');
const AddressIds = require('./addressIds.model');
const Customers = require('./customer.model');
const ReportsList = require('./reportsList.model');
const DebugLogs = require('./debuglog.model');
const DynamicVendor = require("./dynamic-vendor.model")
const DynamicBolVendor = require("./dynamic-bol-vendor.model")

const CurrentVendor = require("./currentVendor.mdel")
const QueueLogs = require('./queuelog.model')

module.exports = {
  AppConfig,
  Credentail,
  Document,
  GlobalMapping,
  Idp,
  RateLimit,
  Role,
  Tenant,
  TrainingFeedback,
  Training,
  User,
  WorkflowLog,
  Workflow,
  Logs,
  Idpkey,
  IdpInfo,
  TenantSetting,
  AiServer,
  WebHook,
  DbConfig,
  InputStorage,
  VendorAI,
  Teams,
  AddressIds,
  Customers,
  ReportsList,
  DebugLogs,
  DynamicVendor,
  CurrentVendor,
  QueueLogs,
  DynamicBolVendor,
};
