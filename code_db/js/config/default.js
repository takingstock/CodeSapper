module.exports = {
  REDIS: {
    URI: 'localhost',
    PORT: 6379,
  },
  ROLES: {
    DEFAULT: 'ENTERPRISE_ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
    TENANT: 'ENTERPRISE_ADMIN',
    INDEXER: 'ENTERPRISE_INDEXER',
    SALES_ADMIN: 'SALES_ADMIN',
    SUPERVISOR: 'ENTERPRISE_SUPERVISOR',
    LIST: ['SUPER_ADMIN', 'ENTERPRISE_ADMIN', 'ENTERPRISE_SUPERVISOR', 'ENTERPRISE_INDEXER'],
  },
  SCHEMA: {
    USERS: 'User',
    ROLES: 'Role',
    TENANTS: 'Tenant',
    CUSTOMER: 'Customer',
    REPORTSLIST: 'ReportsList',
    TEAMS: 'Team',
    APP_CONFIG: 'Configuration',
    DOCUMENTS: 'Documents',
    IDP: 'Idp',
    GLOBAL_MAPPING: 'GlobalMapping',
    TRAINING: 'Training',
    TRAINING_FEEDBACK: 'TrainingFeedback',
    FEEDBACK_BUCKET: 'FeedbackBucket',
    CREDENTIALS: 'Credential',
    WORKFLOW: 'Workflow',
    WORKFLOW_LOGS: 'WorkflowLog',
    WEB_HOOK: 'Webhook',
    DB_CONFIG: 'ExternalDbConfig',
    INPUT_STORAGE: 'INPUT_STORAGE',
    VENDORS: 'Vendor',
    BOlVENDORS: 'bol_vendor',
    VENDORAI: 'indexerVendorChange',
    VENDOR_MAPPING: 'vendorMapping',
    ADDRESSIDS: 'addressIds',
    ENTERPRISE_SETTINGS: "tenantSetting"
  },
  ENV: {
    DEV: 'development',
    PROD: 'production',
    STAGE: 'stage',
    TEST: 'test',
    DEMO: 'demo',
    TRIAL_PROD: 'trial_prod',
  },
  SERVER: {
    PORTS: {
      HAPI: 3669,
      REPORT: 3670
    },
    MAX_UPLOAD_LIMIT: 1024000000, // 1gb
    CRON_DELAY_TIME: 1000, // milliseconds,
    CRON_DOCS_TO_PROCESS_PER_BATCH: 25,
    HOST: '0.0.0.0',
    APP_NAME: 'IDP VisonEra',
    API_TITLE: 'IDP VisonEra API',
    API_DESCRIPTION: "Welcome to IDP VisonEra <br><br><br><a href='/documentation'>Go To Documentation</a>",
    SCHEMES: [
      'https',
      'http',
    ],
    GROUPING: 'tags',
    TEXT: 'Server running at:',
    REPORT_TEXT: 'Report Server running at:',
    VALID_FILE_EXT: [
      'csv',
    ],
    JWT_SECRET_KEY: 'gpRSrXgADcdkwJdTNuUSzPVfwr82FX',
    REDIS_KEY_PREFIX: 'xyz',
    DOWNLOAD_TOKEN_ARRAY: 'DOWNLOAD_TOKEN_ARRAY',
    AXIOS_TIMEOUT: 1000 * 300 * 3, // Wait for 300 [15 Min] seconds
  },
  API: {
    V1: '/api/v1/',
    V2: '/api/v2/',
  },
  SC_API_CONFIG: {
    FILE_PATH_PREFIX: '/CRMDATA/upload',
    ME_HELPER_URL: process.env.NODE_ENV === 'prod' ? 'http://10.56.110.148:3223/' : 'http://10.56.110.148:3223/',
    CASE_LIST: 'https://10.56.110.148:9443/AirtelCrm/index.php?entryPoint=cases_list',
    ATTACHMENT_LIST: 'https://10.56.110.148:9443/AirtelCrm/index.php?entryPoint=get_case_document', // case documents
  },
  API_SPECIFIC: {
    RATE_LIMIT_COUNT: 10,
    ATTACHMENTS_FOLDER_PATH: `${process.env.HOME}/shared_folder_between_apps/eim_attachments/`,
    RATE_LIMIT_TILL: 60 * 60 * 1000, // 60 mins
    CUSTOMER_DETAILS_URL: 'https://10.56.110.148:9443/AirtelCrm/index.php?entryPoint=validate_user_acc',
  },
  REPORTS_FOLDER: {
    PATH: `${process.env.HOME}/shared_folder_between_apps/idp_backend/reports/`
  },
  AMYGB_INFRA: {
    STORAGE_SERVER: 'https://storage.amygbserver.in',
    EMAIL_SERVER: 'https://email.amygbserver.in',
  },
  IMP_FILES: {
    PATH: `${process.env.HOME}/important_files/monitoring-server/`,
    PEM_PATH: `${process.env.HOME}/important_files/idp_ocr.pem`,
  },
  SWAGGER: [
    {
      code: 200,
      message: 'OK',
    },
    {
      code: 400,
      message: 'Bad Request',
    },
    {
      code: 401,
      message: 'Unauthorized',
    },
    {
      code: 404,
      message: 'Data Not Found',
    },
    {
      code: 500,
      message: 'Internal Server Error',
    },
  ],
  EVENTS: {
    MONGOOSE: {
      CONNECTED: 'connected',
      ERROR: 'error',
      DISCONNECTED: 'disconnected',
    },
    REDIS: {
      CONNECT: 'connect',
      ERROR: 'error',
    },
    NODE: {
      UN_HANDLED_REJECTION: 'unhandledRejection',
    },
  },
  STATUS_MSG: {
    ERROR: {
      NO_DOC_FOUND: {
        statusCode: 400,
        type: 'NO_DOC_FOUND',
        message: 'Document not found',
      },
      TEAM_DOES_NOT_EXIST: {
        statusCode: 404,
        type: 'TEAM_DOES_NOT_EXIST',
        message: 'Team not found',
      },
      TEAM_NAME_NOT_FOUND: {
        statusCode: 404,
        type: 'TEAM_NAME_NOT_FOUND',
        message: 'Please Provide Team Name When Creating SuperVisor',
      },
      ROLE_ID_NOT_FOUND: {
        statusCode: 404,
        type: 'ROLE_ID_NOT_FOUND',
        message: 'ROLE ID Not Found',
      },
      TEAM_ALREADY_EXIST: {
        statusCode: 400,
        type: 'TEAM_ALREADY_EXIST',
        message: 'Team Already exists',
      },
      WORKFLOW_EXISTS: {
        statusCode: 400,
        type: 'WORKFLOW_EXISTS',
        message: 'Workflow already exists',
      },
      INVALID_USER_PASS: {
        statusCode: 401,
        type: 'INVALID_USER_PASS',
        message: 'Invalid username or password',
      },
      INVALID_DATE: {
        statusCode: 400,
        message: 'Invalid Date or the range already exists',
        type: 'INVALID_DATE',
      },
      IMP_ERROR: {
        statusCode: 500,
        message: 'Implementation Error',
        type: 'IMP_ERROR',
      },
      USER_NOT_FOUND: {
        statusCode: 404,
        message: 'User not found',
        type: 'USER_NOT_FOUND',
      },
      TRIAL_ACCOUNT_NOT_ALLOWED: {
        statusCode: 401,
        message: 'Trial account not allowed',
        type: 'TRIAL_ACCOUNT_NOT_ALLOWED',
      },
      USER_LOCKED: {
        statusCode: 400,
        message: 'Trouble logging in? Please write to support@amygb.ai.',
        type: 'USER_LOCKED',
      },
      TRIAL_ACCOUNT_EXPIRED: {
        statusCode: 400,
        message: 'Trail account expired',
        type: 'TRIAL_ACCOUNT_EXPIRED',
      },
      TENANT_ALREADY_EXIST: {
        statusCode: 400,
        message: 'Company already exist',
        type: 'TENANT_ALREADY_EXIST',
      },
      TRIAL_ACCOUNT_SUSPENDED: {
        statusCode: 400,
        message: 'Trial account suspended',
        type: 'TRIAL_ACCOUNT_SUSPENDED',
      },
      EMAIL_ALREADY_EXIST: {
        statusCode: 400,
        message: 'Email already exists',
        type: 'EMAIL_ALREADY_EXISTS',
      },
      TICKET_NOT_FOUND: {
        statusCode: 404,
        message: 'Ticket id not found',
        type: 'TICKET_NOT_FOUND',
      },
      ADDRESS_ID_ALREADY_PRESENT: {
        statusCode: 400,
        message: 'Address Id Already Present',
        type: 'ADDRESS_ID_ALREADY_PRESENT',
      },
      INVALID_MONTH: {
        statusCode: 404,
        message: 'Invalid Month Specified, Should be greater than May 2020',
        type: 'INVALID_MONTH',
      },
      BAD_REQUEST: {
        statusCode: 400,
        message: 'Invalid Payload Request/DATA',
        type: 'BAD_REQUEST'
      },
      WRONG_PAYLOAD: {
        statusCode: 400,
        message: 'Invalid Payload Request/DATA',
        type: 'WRONG_PAYLOAD'
      },
      NOT_FOUND: {
        statusCode: 404,
        message: 'User Not Found',
        type: 'NOT_FOUND',
      },
      FORBIDDEN: {
        statusCode: 403,
        message: 'You are not authorized to perform this action',
        type: 'FORBIDDEN',
      },
      UNAUTHORIZED: {
        statusCode: 401,
        message: 'You are not authorized to perform this action',
        type: 'UNAUTHORIZED',
      },
      TOKEN_ALREADY_EXPIRED: {
        statusCode: 401,
        message: 'Token Invalid/Expired',
        type: 'TOKEN_ALREADY_EXPIRED',
      },
      INVALID_TOKEN: {
        statusCode: 401,
        message: 'Invalid token provided',
        type: 'INVALID_TOKEN',
      },
      INVALID_IP: {
        statusCode: 401,
        message: 'Ip address not allowed',
        type: 'INVALID_IP',
      },
      INVALID_VENDOR_REQUEST: {
        statusCode: 400,
        message: 'No Input for search',
        type: 'INVALID_VENDOR_REQUEST',
      },
      FILE_UPLOAD: {
        INVALID_FILE: {
          statusCode: 400,
          message: 'Invalid or corrupt file',
          type: 'INVALID_FILE',
        },
        NO_VALID_EXT: {
          statusCode: 400,
          message: "The Zip file doesn't contain any valid extension file",
          type: 'NO_VALID_EXT',
        },
        EXT_NOT_ALLOWED: {
          statusCode: 400,
          message: 'File extension not allowed',
          type: 'EXT_NOT_ALLOWED',
        },
        FILE_NOT_FOUND: {
          statusCode: 404,
          message: 'File not found',
          type: 'FILE_NOT_FOUND',
        },
        ORIGINAL_NOT_FOUND: {
          statusCode: 404,
          message: 'Original file not found',
          type: 'ORIGINAL_NOT_FOUND',
        },
        FILE_TYPE_MISMATCH: {
          statusCode: 400,
          message: 'Current file type is different from original file',
          type: 'FILE_TYPE_MISMATCH',
        },
      },
      TOO_MANY_REQUESTS: {
        statusCode: 429,
        message: 'Too Many Requests',
        type: 'TOO_MANY_REQUESTS',
      },
      INVALID_OTP: {
        statusCode: 400,
        message: 'Otp expired or invalid',
        type: 'INVALID_OTP',
      },
      GOOGLE_ERROR: {
        statusCode: 400,
        type: 'GOOGLE_ERROR',
        message: 'Error: '
      },
      INVALID_CAPTCHA: {
        statusCode: 404,
        message: 'Invalid Captcha',
        type: 'INVALID_CAPTCHA'
      },
      MAINTENANCE: {
        statusCode: 503,
        message: 'Server in maintenance',
        type: 'MAINTENANCE'
      },
    },
    SUCCESS: {
      DEFAULT: {
        statusCode: 200,
        message: 'Success',
        type: 'DEFAULT',
      },
      CREATED: {
        statusCode: 201,
        message: 'Created Successfully',
        type: 'CREATED',
      },
      UPDATED: {
        statusCode: 200,
        message: 'Updated Successfully',
        type: 'UPDATED',
      },
      LOGIN: {
        statusCode: 200,
        message: 'Logged In Successfully',
        type: 'LOGIN',
      },
      REGISTER: {
        statusCode: 200,
        message: 'Registered Successfully',
        type: 'REGISTER',
      },
      LOGOUT: {
        statusCode: 200,
        message: 'Logged Out Successfully',
        type: 'LOGOUT',
      },
      CHANGE_PASSWORD: {
        statusCode: 200,
        message: 'Password Updated Successfully',
        type: 'CHANGE_PASSWORD',
      },
      DELETE_USER: {
        statusCode: 200,
        message: 'User Deleted Successfully',
        type: 'DELETE_USER',
      },
      DELETE_SUCCESS: {
        statusCode: 200,
        message: 'Deleted Successfully',
        type: 'DELETE_SUCCESS',
      },
      ASSIGN_SUCCESS: {
        statusCode: 200,
        message: 'Assigned Successfully',
        type: 'ASSIGN_SUCCESS',
      },
      CONFIG_SUCCESS: {
        statusCode: 200,
        message: 'Created Successfully',
        type: 'CONFIG_SUCCESS',
      },
    },
  },
  ERR_MESSAGES: {
    EMAIL_ALREADY_EXIST: 'Email already exist',
    TENANT_ALREADY_EXIST: 'Tenant already exist',
    VALID_EMAIL: 'Enter a valid email',
    VALID_OBJECTID: 'Enter a valid ID',
    VALID_USER_NAME: 'Enter a valid name',
    UPLOAD_FILES_INVALID: 'Uploaded files are not valid',
    IDP_SELECT_UPLOAD: 'please select file to upload',
    CONFIG_ALREADY_EXIST: 'Config name already exist',
    DOCUMENT_TYPE_ALREADY_EXIST: 'Document type already exist',
    INVALID_ZIP: 'The Zip file is not valid',
    INVALID_RAR: 'The Rar file is not valid',
    WORKFLOW_EXISTS: 'Workflow already exists',
  },
  DOCS: {
    INVOICE: 'invoice',
    AADHAAR: 'aadhaar',
    PAN: 'pan',
    RC: 'rc',
  },
  DB_DOC_TYPE: {
    TRAINING: 'TRAINING', // docs upload for traianing
    PROCESSING: 'PROCESSING', // docs upload for enterprise process
  },
  AI_STATUS: {
    OCR_PENDING: 'OCR_PENDING',
    OCR_INPROGRESS: 'OCR_INPROGRESS',
    OCR_DONE: 'OCR_COMPLETE',
    OCR_FAILED: 'OCR_FAILED',
    QR_PROCESSED: 'QR_PROCESSED',
    QR_PENDING: 'QR_PENDING',
    QR_DONE: 'QR_COMPLETE',
    QR_FAILED: 'QR_FAILED',
    QR_NOT_FOUND: 'QR_NOT_FOUND',
    FEEDBACK_PENDING: 'FEEDBACK_PENDING',
    FEEDBACK_DONE: 'FEEDBACK_COMPLETE',
    FEEDBACK_FAILED: 'FEEDBACK_FAILED',
    FEEDBACK_TABULAR_FAILED: 'FEEDBACK_FAILED_TABULAR',
    FEEDBACK_NON_TABULAR_FAILED: 'FEEDBACK_FAILED_NON_TABULAR',
    OCR_RETRY: 'OCR_RETRY'
  },
  CONFIG_TYPE: {
    OUTPUT_SOURCE: 'OUTPUT_SOURCE',
    INPUT_SOURCE: 'INPUT_SOURCE',
    UPLOAD: 'UPLOAD',
    API_CALL: 'API_CALL',
    EMAIL: 'EMAIL',
    S3_BUCKET: 'S3_BUCKET',
    WHATSAPP: 'WHATSAPP',
    GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  },
  FILE_EXTENSIONS: {
    RAR: '.rar',
    ZIP: '.zip',
  },
  OUTPUT_EXTENSIONS: {
    JSON: 'json',
    API: 'api',
    CSV: 'csv',
    BATCH: 'batch',
    EMAIL: 'email',
    ZOHO: 'zoho',
    SAP: 'SALESFORCE',
  },
  CONFIG_SETTING_TYPES: {
    GLOBAL: 'global',
    ENTERPRISE: 'enterprise',
    RULE: 'rule',
  },
  REST_API_METHODS: {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    DELETE: 'DELETE',
  },
  AUTH_STRATEGIES: {
    API_AUTH: 'api-auth',
    API_KEY_AUTH: 'idp-api-key-auth',
    SIMPLE: 'simple',
  },
  EXCEPTION_TYPES: {
    ERROR: 'error',
    WARNING: 'warn',
    INFO: 'info',
    FATAL: 'fatal',
  },
  VALID_FILES_EXTENSIONS: ['.jpg', '.jpeg', '.JPG', '.JPEG', '.png', '.PNG', '.pdf', '.PDF', '.tiff', '.TIFF', '.tif', '.TIF'],
  UPLOAD_INPUT_KEY: 'files',
  OCR_UPLOAD_INPUT_KEY: 'file',
  HOST: {
    development: 'http://idpmigratedstaging.amygbdemos.in/',
    production: 'https://idpbackendprod.amygbserver.in/',
    stage: 'https://idpstaging.amygbserver.in/',
    trial: 'https://idpmigratedstaging.amygbdemos.in/',
    demo: 'http://idpdemodev.amygbdemos.in/',
    prod_v1: 'https://idpbackendv1.amygbserver.in/',
    mark_stage: 'https://requordit-staging.amygbserver.in/',
    mark_prod: 'https://requordit.amygbserver.in/',
    scalar: 'https://idpscaler.amygbserver.in/',
  },
  FRONT_END: {
    development: 'http://idpmigratedstaging.amygbdemos.in/',
    production: 'https://idpbackendprod.amygbserver.in/',
    trial: 'https://idptrial.amygb.ai/',
    stage: '',
    demo: 'http://idpdemodev.amygbdemos.in/',
    prod_v1: 'https://idpv1.amygb.ai/',
    mark_stage: 'http://idp-requordit-staging.s3-website.ap-south-1.amazonaws.com/',
    mark_prod: 'https://idprequordit.amygb.ai/',
    scalar: 'https://idprequordit.amygb.ai/'
  },
  QR_DENSITY: [
    {
      den: 300,
      ext: 'jpg',
    },
    {
      den: 200,
      ext: 'jpg',
    },
    {
      den: 300,
      ext: 'png',
    },
    {
      den: 200,
      ext: 'png',
    },
  ],
  APP_EVENTS: {
    OCR: 'OCR_CHANGES',
    FEEDBACK: 'FEEDBACK_CHANGES',
    AI_ERROR: 'AI_ON_ERROR',
    BUCKET: 'BUCKET_CHANGES',
    REFRESH_BATCHES: "NEW_BATCH_REFRESH"
  },
  BUCKET_TYPES: {
    NO_TABLE_DETECTION: 'No Table Detection',
    KEY_VALUE_FAILURE: 'Key Value Failure',
    NO_DETECTION: 'No Detection',
  },
  SOCKET_EVENTS: {
    OCR_DOCUMENT: 'PUBLISH_AI_STATUS_DOCUMENTS',
    OCR_TRAINING_DOCUMENT: 'PUBLISH_AI_STATUS_TRAINING',
    BUCKET_BATCH_DOCUMENT: 'BUCKET_BATCH_DOCUMENT',
  },
  FEEDBACK_TYPES: {
    TABULAR: 'TABULAR',
    NON_TABULAR: 'NON_TABULAR',
  },
  IMC: {
    SMS_SENT_PERMISSION: true,
    TOKEN: '9c72de2d9bb476ce68aa0f2abdcb0198',
    REPORTS_TEAM: 'shahab@amygb.ai, auqib@amygb.ai, anish.ahmed@amygb.ai, rohith.reddy@amygb.ai, vikram@amygb.ai, abhijeet@amygb.ai, sanib.mohammad@amygb.ai, admin@amygb.ai',
    LOGS_TEAM: 'shubham.verma@amygb.ai, shahab@amygb.ai, auqib@amygb.ai ',
    ALERTS_TEAM: 'shahab@amygb.ai',
    NEW_ALERTS: 'shubham.verma@amygb.ai',
    QUEUE_LOGS: 'shubham.verma@amygb.ai, shahab@amygb.ai, auqib@amygb.ai, anish.ahmed@amygb.ai, rohith.reddy@amygb.ai, vikram@amygb.ai, abhijeet@amygb.ai, sanib.mohammad@amygb.ai',
    DEV_TESTING: 'auqib@amygb.ai, shahab@amygb.ai, abhijeet@amygb.ai, pallavi@amygb.ai, varun@amygb.ai',
    OCR_RESPONSIBLE_TEAM: 'abhijeet@amygb.ai, farha@amygb.ai, auqib@amygb.ai, shahab@amygb.ai, anish.ahmed@amygb.ai, rohith.reddy@amygb.ai, vikram@amygb.ai',
    QUEUE_SIZE_TEAM: 'ivan.moreno@requordit.com, ana.frias@requordit.com,lennin.mendoza@requordit.com,abhijeet@amygb.ai, farha@amygb.ai, auqib@amygb.ai, shahab@amygb.ai, anish.ahmed@amygb.ai, rohith.reddy@amygb.ai, vikram@amygb.ai',
    FEEDBACK_RESPONSIBLE_TEAM: 'rohith.reddy@amygb.ai, auqib@amygb.ai, shahab@amygb.ai, anish.ahmed@amygb.ai, abhijeet@amygb.ai',
    PLATFORM_TEAM: 'auqib@amygb.ai, farha@amygb.ai, shahab@amygb.ai',
    APIS: {
      EMAIL_SEND: 'https://email.amygbserver.in/api/emailManager/sendEmailFromSecondaryServer',
    },
    OCR_DEMO_RESPONSE_URL: 'https://s3-ap-south-1.amazonaws.com/vision-era-uploads/demo_master_file.json',
    OCR_PROD_DEMO_RESPONSE_URL: 'https://s3-ap-south-1.amazonaws.com/vision-era-uploads/demo_master_file_prod.json',
  },
  TRIAL_ACCOUNT: {
    NEW_SIGNUP_ALERT_EMAILS: 'auqib@amygb.ai, akanksha@amygb.ai, sales@amygb.ai, anish.ahmed@amygb.ai, preeti@amygb.ai, saneesh.veetil@amygb.ai, nasreen.shaikh@amygb.ai, sowmya@amygb.ai, farha@amygb.ai',
    TEAM_EMAILS: 'akanksha@amygb.ai,anish.ahmed@amygb.ai, farha@amygb.ai, auqib@amygb.ai',
    SUBJECT: 'VisionERA (Trial Activation)',
    URL: 'https://idptrial.amygb.ai',
    EXPIRY_IN_DAYS: 7,
    LINK: 'https://www.amygb.ai/idp-platform/',
  },
  WORKFLOWS_DEFAULT_V2: [
    {
      country: 'india',
      name: 'All Documents',
      status: 'Published',
      docSlugs: {
        'seedId_2': true,
        'seedId_3': true,
        'seedId_4': true,
        'seedId_5': true,
        'seedId_6': true,
        'seedId_7': true,
        'seedId_8': true,
        'seedId_9': true,
        'seedId_10': true,
      },
      primaryDocSlug: 'seedId_9'
    }
  ],
  TRIALUSER_WORKFLOWS_DEFAULT: [
    {
      country: 'india',
      name: 'KYC Documents',
      status: 'Published',
      docSlugs: {
        'seedId_9': true,
        "seedId_8": true,
        "seedId_7": true
      },
      primaryDocSlug: 'seedId_9'
    },
    {
      country: 'india',
      name: 'Onboarding Forms',
      status: 'Published',
      docSlugs: {
        'seedId_3': true
      },
      primaryDocSlug: 'seedId_3'
    },
    {
      country: 'india',
      name: 'Payslips samples',
      status: 'Published',
      docSlugs: {
        'seedId_5': true,
      },
      primaryDocSlug: 'seedId_5'
    },
    {
      country: 'india',
      name: 'Bank Transactions',
      status: 'Published',
      docSlugs: {
        'seedId_2': true,
      },
      primaryDocSlug: 'seedId_2'
    },
    {
      country: 'india',
      name: 'Motor Insurance Policy',
      status: 'Published',
      docSlugs: {
        'seedId_4': true,
      },
      primaryDocSlug: 'seedId_4'
    },
    {
      country: 'india',
      name: 'Invoices Static',
      status: 'Published',
      static: true,
      docSlugs: {
        'seedId_10': true
      },
      primaryDocSlug: 'seedId_10'
    },
    {
      country: 'india',
      name: 'PAN',
      status: 'Published',
      docSlugs: {
        'seedId_11': true
      },
      primaryDocSlug: 'seedId_11'
    },
  ],
  TRIALUSER_WORKFLOWS_DEFAULT_CURTIS_WRIGHT: [
    {
      country: 'india',
      name: 'Invoices',
      status: 'Published',
      docSlugs: {
        'seedId_10': true
      },
      primaryDocSlug: 'seedId_10'
    }
  ],
  OCR_MAX_TIME_LIMIT: 5,
  OCR_RETRY_MAX_TIME_LIMIT: 5,
  WORKFLOWS_MARK: [{
    country: 'india',
    name: 'Invoices Static',
    status: 'Published',
    static: true,
    docSlugs: {
      'seedId_10': true
    },
    primaryDocSlug: 'seedId_10'
  }]
};
