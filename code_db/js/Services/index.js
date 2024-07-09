const AppConfig = require('./app-config.service');
const Credential = require('./credentials.service');
const Document = require('./document.service');
const GlobalMapping = require('./global-mapping.service');
const Idp = require('./idp.service');
const RateLimit = require('./rate-limiting.service');
const Role = require('./role.service');
const Tenant = require('./tenant.service');
const TrainingFeedback = require('./training-feedback.service');
const Training = require('./training.service');
const User = require('./user.service');
const WorkflowLog = require('./workflow-log.service');
const Workflow = require('./workflow.service');
const Logs = require('./logs.service')
const Teams = require('./teams.service');
const AddressIds = require('./addressIds.service');
const Customers = require('./customer.service');
const ReportsList = require('./reports-list.service');
const DebugLogs = require('./debugLogs.service');
const DynamicVendors = require('./dynamic-vendor.service')
const DynamicBolVendors = require('./dynamic-bol-vendor.service')

const QueueLogs = require('./queueLogs.service')
const Page = require('./page.service')

module.exports = {
  appConfigService: AppConfig,
  credentialService: Credential,
  documentService: Document,
  globalMappingService: GlobalMapping,
  idpService: Idp,
  rateLimitingService: RateLimit,
  roleService: Role,
  tenantService: Tenant,
  trainingFeedbackService: TrainingFeedback,
  trainingService: Training,
  userService: User,
  workflowLogService: WorkflowLog,
  workflowService: Workflow,
  logsService: Logs,
  bolVendorsService: DynamicBolVendors,
  VendorsService: DynamicVendors,
  teamsService: Teams,
  addressIdsService: AddressIds,
  customersService: Customers,
  reportsListService: ReportsList,
  debugLogsService: DebugLogs,
  queueLogsService: QueueLogs,
  pageService: Page,
};
