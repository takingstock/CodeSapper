const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const config = require('config');

const { authorizationHeaderObj } = require('../../Utils/universal-functions.util');
const {
  CONFIG_PAYLOAD_SCHEMA,
  CONFIG_SEARCH_SCHEMA,
  DOCUMENT_ASSIGN_SCHEMA,
  DOCUMENT_SEARCH_SCHEMA,
  DOCUMENT_SNIPPLET_SCHEMA,
  DOCUMENT_UPDATE_SCHEMA,
  DOC_MAPPING_DOWNLOAD_SCHEMA,
  IDP_PAYLOAD_UPLOAD_SCHEMA,
  IDP_QUERY_UPLOAD,
  ID_SCHEMA,
  LOGIN_SCHEMA,
  MAPPING_PAYLOAD_SCHEMA,
  MAPPING_PAYLOAD_UPDATE_SCHEMA,
  MULTIPLE_OBJECT_ID_SCHEMA,
  PASSWORD_SCHEMA,
  PROFILE_SCHEMA,
  SEARCH_SCHEMA,
  SEARCH_SCHEMA_GLOBAL_MAPPING,
  SEARCH_SCHEMA_OCR,
  TRAINING_KEY_VALUES_PARAMS_SCHEMA,
  TRAINING_NON_TABULAR_SCHEMA,
  TRAINING_TABULAR_SCHEMA,
  USER_SCHEMA,
  USER_UPDATE_SCHEMA,
  ADMIN_USER_UPDATE_SCHEMA,
  ADMIN_USER_SCHEMA,
  RULE_ENGINE_PAYLOAD_SCHEMA,
  STATS_QUERY_SCHEMA,
  IDP_SEARCH_SCHEMA,
  IDP_DOWNLOAD_LINK,
  CREDENTIALS_PAYLOAD_SCHEMA,
  CREDENTIALS_SEARCH_SCHEMA,
  IMC_DOCUMENT_SEARCH_SCHEMA,
  IMC_GLOBAL_MAPPING_PAYLOAD_UPDATE_SCHEMA,
  IMC_OCR_UPDATE_URL_SCHEMA,
  REGISTER_SCHEMA,
  BATCH_ID_SCHEMA,
  TRIAL_EXTEND_SCHEMA,
  IMC_USER_UPDATE_SCHEMA,
  SEARCH_ADMIN_SCHEMA,
  TENANT_ID_SCHEMA,
  PAYLOAD_START_QC,
  DOCUMENT_QC_SCHEMA,
  EXTEND_REQUEST_SCHEMA,
  FORGOT_SCHEMA,
  CHANGE_PASSWORD_SCHEMA,
  FETCH_DATA_FOR_AI,
  COUNT_DATA_FOR_AI
} = require('../../Validations');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
const SUPERVISOR = [...ENTERPRISE, ROLES.SUPERVISOR]
const INDEXER = [...SUPERVISOR, ROLES.INDEXER];
const V1 = config.get('API.V1');
const REST_API_METHODS = config.get('REST_API_METHODS');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const MAX_UPLOAD_LIMIT = config.get('SERVER.MAX_UPLOAD_LIMIT');

// rate limiting
const ROUTES_RATE_LIMIT_MOD = [
  {
    method: 'GET',
    route: '/api/rateLimiting/getList',
    options: {
      handler: 'getList',
      validate: {
        headers: authorizationHeaderObj,
      },
      // auth: AUTH_STRATEGIES.API_AUTH,
      description: 'Get Rate Limited Entries List',
      tags: ['rateLimiting', 'api'],
    },
  },
  {
    method: 'DELETE',
    route: '/api/rateLimiting/deleteEntry',
    options: {
      handler: 'deleteEntry',
      validate: {
        headers: authorizationHeaderObj,
        payload: {
          ip: Joi.string().ip().optional(),
          userId: Joi.string().optional(),
          customerId: Joi.string().optional(),
        },
      },
      // auth: AUTH_STRATEGIES.API_AUTH,
      description: 'Delete Rate Limited Entry',
      tags: ['rateLimiting', 'api'],
    },
  },
];

// auth routes
const ROUTES_AUTH_MOD = [
  {
    handler: 'loginHandler',
    route: `${V1}user/login`,
    method: REST_API_METHODS.POST,
    options: {
      validate: {
        payload: LOGIN_SCHEMA,
      },
      description: 'login user',
      tags: ['auth', 'api'],
    },
    internalErrorMessage: 'loginHandler',
  },
  {
    handler: 'registerHandler',
    route: `${V1}user/register`,
    method: REST_API_METHODS.POST,
    options: {
      validate: {
        payload: REGISTER_SCHEMA,
      },
      description: 'register user',
      tags: ['auth', 'api'],
    },
    internalErrorMessage: 'registerHandler',
  },
  {
    handler: 'logoutUser',
    route: `${V1}user/logout`,
    method: REST_API_METHODS.POST,
    options: {
      validate: {
        headers: authorizationHeaderObj,
      },
      auth: AUTH_STRATEGIES.API_AUTH,
      tags: ['auth', 'api'],
      description: 'logout user',
    },
    internalErrorMessage: 'logoutUser',
  },
  {
    handler: 'forgotPassword',
    route: `${V1}user/forgotPassword`,
    method: REST_API_METHODS.POST,
    options: {
      validate: {
        payload: FORGOT_SCHEMA,
      },
      description: 'Forgot user password',
      tags: ['auth', 'api'],
    },
    internalErrorMessage: 'forgotPassword',
  },
  {
    handler: 'changePassword',
    route: `${V1}user/changePassword`,
    method: REST_API_METHODS.POST,
    options: {
      validate: {
        payload: CHANGE_PASSWORD_SCHEMA,
      },
      description: 'change user password',
      tags: ['auth', 'api'],
    },
    internalErrorMessage: 'changePassword',
  },
  {
    handler: 'requestEmailVerification',
    route: `${V1}user/requestOtp`,
    method: REST_API_METHODS.POST,
    options: {
      validate: {
        query: Joi.object({ email: Joi.string().min(3).required().email() }),
      },
      description: 'Request otp email verification',
      tags: ['auth', 'api'],
    },
    internalErrorMessage: 'requestEmailVerifiaction',
  }
];

// role routes
const ROUTES_ROLE_MOD = [
  // [Route]- fetch roles list
  {
    method: 'GET',
    route: `${V1}roles`,
    handler: 'roleList',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'role list',
      tags: ['role', 'api'],
    },
    internalErrorMessage: 'roleList',
  },
  // [Route]- fetch role detail
  {
    method: 'GET',
    route: `${V1}roles/{id}`,
    handler: 'roleDetail',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'role detail',
      tags: ['role', 'api'],
    },
    internalErrorMessage: 'roleDetail',
  },
];

// user routes
const ROUTES_USER_MOD = [
  // [Route]- fetch loggedIn user profile
  {
    method: 'GET',
    route: `${V1}users/profile`,
    handler: 'userProfile',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
      },
      description: 'fetch user profile',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'userProfile',
  },
  // [Route]- update loggedIn user profile
  {
    method: 'PUT',
    route: `${V1}users/profile`,
    handler: 'updateProfile',
    options: {
      validate: {
        payload: PROFILE_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
      },
      description: 'update user profile',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'updateProfile',
  },
  // [Route]- update loggedIn user password
  {
    method: 'PUT',
    route: `${V1}users/changePassword`,
    handler: 'changePassword',
    options: {
      validate: {
        payload: PASSWORD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
      },
      description: 'update user password',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'changePassword',
  },
  // [Route]- fetch users
  {
    method: 'GET',
    route: `${V1}users`,
    handler: 'userList',
    options: {
      validate: {
        query: SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'user list',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'userList',
  },
  // [Route]- fetch users detail
  {
    method: 'GET',
    route: `${V1}users/{id}`,
    handler: 'userDetail',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'user detail',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'userDetail',
  },
  // [Route]- create users
  {
    method: 'POST',
    route: `${V1}users`,
    handler: 'userCreate',
    options: {
      validate: {
        payload: USER_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'user create',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'userCreate',
  },
  // [Route]- update users
  {
    method: 'PUT',
    route: `${V1}users/{id}`,
    handler: 'userUpdate',
    options: {
      validate: {
        params: ID_SCHEMA,
        payload: USER_UPDATE_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'user update',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'userUpdate',
  },
  // [Route]- delte users
  {
    method: 'DELETE',
    route: `${V1}users/{id}`,
    handler: 'userDelete',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'user delete',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'userDelete',
  },
  // [Route]- trial Extend
  {
    method: 'PUT',
    route: `${V1}users/request/extend`,
    handler: 'requestExtension',
    options: {
      validate: {
        payload: EXTEND_REQUEST_SCHEMA,
      },
      description: 'Request Extension public api',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'REQUEST EXTENSION',
  },
  // [Route]- trial Extend
  {
    method: 'PUT',
    route: `${V1}users/trailExtend/{id}`,
    handler: 'trialExtend',
    options: {
      validate: {
        params: ID_SCHEMA,
        payload: TRIAL_EXTEND_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: '*Depricated Trial extend ',
      tags: ['users', 'api'],
    },
    internalErrorMessage: 'userCreate',
  },
];

// config routes
const ROUTES_CONFIG_MOD = [
  {
    method: REST_API_METHODS.GET,
    route: `${V1}config`,
    handler: 'configFetch',
    options: {
      validate: {
        query: CONFIG_SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['config', 'api'],
      description: 'fetch config',
    },
    internalErrorMessage: 'configFetch',
  },
  {
    method: REST_API_METHODS.GET,
    route: `${V1}config/{id}`,
    handler: 'configFetchDetail',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['config', 'api'],
      description: 'fetch config detail',
    },
    internalErrorMessage: 'configFetchDetail',
  },
  {
    method: REST_API_METHODS.POST,
    route: `${V1}config`,
    handler: 'configCreateConfig',
    options: {
      validate: {
        payload: CONFIG_PAYLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['config', 'api'],
      description: 'create config',
    },
    internalErrorMessage: 'configCreateConfig',
  },
  {
    method: REST_API_METHODS.PUT,
    route: `${V1}config/{id}`,
    handler: 'configUpdateConfig',
    options: {
      validate: {
        payload: CONFIG_PAYLOAD_SCHEMA,
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['config', 'api'],
      description: 'update config',
    },
    internalErrorMessage: 'configUpdateConfig',
  },
  {
    method: REST_API_METHODS.DELETE,
    route: `${V1}config`,
    handler: 'configDeleteConfig',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['config', 'api'],
      description: 'delete config',
    },
    internalErrorMessage: 'configDeleteConfig',
  },
];

// global mapping routes
const ROUTES_GLOBAL_MAPPING_MOD = [

  // [Route]- fetch all globalMapping
  {
    method: REST_API_METHODS.GET,
    route: `${V1}globalMapping`,
    handler: 'mappingFetch',
    options: {
      validate: {
        query: SEARCH_SCHEMA_GLOBAL_MAPPING,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['mapping', 'api'],
      description: 'fetch mapping',
    },
    internalErrorMessage: 'fetch mapping',
  },
  // [Route]- fetch globalMapping detail
  {
    method: REST_API_METHODS.GET,
    route: `${V1}globalMapping/{id}`,
    handler: 'mappingFetchDetail',
    options: {
      validate: {
        params: ID_SCHEMA,
        query: Joi.object({
          tenantId: Joi.objectId().optional()
        })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['mapping', 'api'],
      description: 'fetch mapping detail',
    },
    internalErrorMessage: 'fetch mapping detail',
  },
  // [Route]- create globalMapping
  {
    method: REST_API_METHODS.POST,
    route: `${V1}globalMapping`,
    handler: 'mappingCreate',
    options: {
      validate: {
        payload: MAPPING_PAYLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['mapping', 'api'],
      description: 'create mapping',
    },
    internalErrorMessage: 'create mapping',
  },
  // [Route]- update globalMapping detail
  {
    method: REST_API_METHODS.PUT,
    route: `${V1}globalMapping/{id}`,
    handler: 'mappingUpdate',
    options: {
      validate: {
        payload: MAPPING_PAYLOAD_UPDATE_SCHEMA,
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['mapping', 'api'],
      description: 'update mapping',
    },
    internalErrorMessage: 'update mapping',
  },
  // [Route]- delete globalMapping
  {
    method: REST_API_METHODS.DELETE,
    route: `${V1}globalMapping`,
    handler: 'mappingDelete',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['mapping', 'api'],
      description: 'delete mapping',
    },
    internalErrorMessage: 'delete mapping',
  }
];

// idp routes
const ROUTES_IDP_MOD = [
  // [Route]- download files as zip
  {
    method: 'POST',
    route: `${V1}idp/createDownloadLink`,
    handler: 'batchCreateDownloadLink',
    options: {
      validate: {
        payload: IDP_DOWNLOAD_LINK,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'batch download',
      tags: ['idp', 'api'],
    },
    internalErrorMessage: 'batchCreateDownloadLink',
  },
  {
    handler: 'processUpload',
    scope: ENTERPRISE,
    route: `${V1}idp/upload`,
    method: REST_API_METHODS.POST,
    strategy: AUTH_STRATEGIES.API_AUTH,
    options: {
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data',
        multipart: true,
        maxBytes: MAX_UPLOAD_LIMIT,
      },
      validate: {
        payload: IDP_PAYLOAD_UPLOAD_SCHEMA,
        query: IDP_QUERY_UPLOAD,
      },
      plugins: {
        'hapi-swagger': {
          payloadType: 'form',
        },
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['idp', 'api'],
      description: 'upload docs',
    },
    internalErrorMessage: 'processUpload',
  },
  {
    handler: 'processUpload',
    scope: ENTERPRISE,
    route: `${V1}idp/upload/{id}`,
    method: REST_API_METHODS.PUT,
    options: {
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data',
        multipart: true,
        maxBytes: MAX_UPLOAD_LIMIT,
      },
      validate: {
        params: ID_SCHEMA,
        payload: IDP_PAYLOAD_UPLOAD_SCHEMA,
        query: IDP_QUERY_UPLOAD,
      },
      plugins: {
        'hapi-swagger': {
          payloadType: 'form',
        },
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'update upload docs',
      tags: ['idp', 'api'],
    },
    internalErrorMessage: 'processUploadUpdate',
  },
  {
    handler: 'idpList',
    scope: ENTERPRISE,
    route: `${V1}idp`,
    method: REST_API_METHODS.GET,
    options: {
      validate: {
        query: IDP_SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['idp', 'api'],
      description: 'fetch docs batch',
    },
    internalErrorMessage: 'idpList',
  },
  {
    handler: 'idpDetail',
    scope: ENTERPRISE,
    route: `${V1}idp/{id}`,
    method: REST_API_METHODS.GET,
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['idp', 'api'],
      description: 'doc detail',
    },
    internalErrorMessage: 'idpDetail',
  },
  {
    handler: 'idpDelete',
    route: `${V1}idp`,
    method: REST_API_METHODS.DELETE,
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['idp', 'api'],
      description: 'delete uploaded doc',
    },
    internalErrorMessage: 'idpDelete',
  },
  {
    handler: 'idpStartAiProcess',
    route: `${V1}idp/startAiProcess`,
    method: REST_API_METHODS.PUT,
    options: {
      validate: {
        payload: BATCH_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['idp', 'api'],
      description: 'Start/restart ai process on batch',
    },
    internalErrorMessage: 'idpStartAiProcess',
  },
  {
    handler: 'qualityCheck',
    route: `${V1}idp/qualityCheck`,
    method: REST_API_METHODS.PUT,
    options: {
      validate: {
        payload: PAYLOAD_START_QC,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['idp', 'api'],
      description: 'qualityCheck',
    },
    internalErrorMessage: 'qualityCheck',
  },
  {
    handler: 'idpBatchList',
    scope: ENTERPRISE,
    route: `${V1}batches`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true,
      },
      validate: {
        query: Joi.object({
          uploadedVia: Joi.string().valid('WEBSITE', 'API').optional(),
          externalCustomerId: Joi.string().optional(),
          externalBatchId: Joi.string().optional(),
          uploadedDocType: Joi.string().optional(),
          qcStatus: Joi.string().valid('PENDING', 'COMPLETED').optional()
        }).concat(SEARCH_COMMON_SCHEMA)
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch docs batchList',
    },
    internalErrorMessage: 'idpBatchList',
  },
  {
    handler: 'batchDropdownList',
    scope: INDEXER,
    route: `${V1}dropdownBatches`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true
      },
      validate: {
        query: Joi.object({ uploadedVia: Joi.string().valid('WEBSITE', 'API').optional() }).concat(SEARCH_COMMON_SCHEMA)
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch docs batchDropdownList',
    },
    internalErrorMessage: 'batchDropdownList',
  },
  {
    handler: 'batchDetails',
    scope: INDEXER,
    route: `${V1}batch`,
    method: REST_API_METHODS.GET,
    options: {
      validate: {
        query: Joi.object({ idpId: Joi.objectId().required() })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch batchDetails',
    },
    internalErrorMessage: 'batchDetails',
  },
  {
    handler: 'fileListing',
    route: `${V1}files`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true
      },
      validate: {
        query: Joi.object({
          idpId: Joi.objectId().required(),
          status: Joi.string().optional().valid("OCR_FAILED", "OCR_SUCCESS"),
          qcStatus: Joi.string().optional().valid("PENDING", "COMPLETED"),
          classification: Joi.string().optional().valid("PENDING", "COMPLETED"),
          fileName: Joi.string().optional()
        }).concat(SEARCH_COMMON_SCHEMA)
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch file listing',
    },
    internalErrorMessage: 'fileListing',
  },
  {
    handler: 'pageListing',
    scope: INDEXER,
    route: `${V1}pages`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true,
      },
      validate: {
        query: Joi.object({ idpId: Joi.objectId().required(), fileName: Joi.string().optional() }).concat(SEARCH_COMMON_SCHEMA)
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch page listing',
    },
    internalErrorMessage: 'pageListing',
  },
  {
    handler: 'superVisorAssignedFileListing',
    route: `${V1}files/assigned`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true
      },
      validate: {
        query: Joi.object({
          idpId: Joi.objectId().optional(),
          fileName: Joi.string().optional(),
          classification: Joi.string().valid("ASSIGNED_SUPERVISOR", "COMPLETED").optional(),
          qcStatus: Joi.string().valid("ASSIGNED_SUPERVISOR", "COMPLETED").optional(),
          batchName: Joi.string().optional(),
          externalCustomerId: Joi.string().optional(),
          externalBatchId: Joi.string().optional(),
          nextBatch: Joi.boolean().optional(),
          nextFile: Joi.boolean().optional(),
          uploadedDocType: Joi.string().optional(),
        }).concat(SEARCH_COMMON_SCHEMA)
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPERVISOR,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch files assigned to supervisor',
    },
    internalErrorMessage: 'superVisorAssignedFileListing',
  },
  {
    handler: 'superVisorFiles',
    route: `${V1}files/supervisor`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPERVISOR,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch assigned to supervisor file listing counts',
    },
    internalErrorMessage: 'superVisorFiles',
  },
  {
    handler: 'indexerAssignedFileListing',
    route: `${V1}files/assignedIndexer`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true
      },
      validate: {
        query: Joi.object({
          idpId: Joi.objectId().optional(),
          status: Joi.string().optional().valid("OCR_FAILED", "OCR_SUCCESS"),
          qcStatus: Joi.string().optional().valid("PENDING", "COMPLETED"),
          classification: Joi.string().optional().valid("PENDING", "COMPLETED"),
          fileName: Joi.string().optional(),
          batchName: Joi.string().optional(),
          externalCustomerId: Joi.string().optional(),
          externalBatchId: Joi.string().optional(),
          nextBatch: Joi.boolean().optional(),
          nextFile: Joi.boolean().optional(),
          uploadedDocType: Joi.string().optional(),
        }).concat(SEARCH_COMMON_SCHEMA)
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch files assigned to indexer',
    },
    internalErrorMessage: 'indexerAssignedFileListing',
  },
  {
    handler: 'indexerFiles',
    route: `${V1}files/indexer`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true
      },
      validate: {
        query: Joi.object({
          idpId: Joi.objectId().optional(),
        })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'fetch assigned to indexer file listing counts',
    },
    internalErrorMessage: 'indexerFiles',
  },
  {
    handler: 'reClassifyDocumentsFromFile',
    scope: INDEXER,
    route: `${V1}file/documentClassification`,
    method: REST_API_METHODS.POST,
    options: {
      timeout: { server: 1000 * 60 * 10 },
      payload: {
        maxBytes: MAX_UPLOAD_LIMIT * 40,
        timeout: 1000 * 60 * 10
      },
      validate: {
        payload: Joi.object({
          idpId: Joi.objectId().required(),
          fileName: Joi.string().optional(),
          newClassification: Joi.array().items({
            documentId: Joi.string().required(),
            fileName: Joi.string().optional(),
            changed: Joi.boolean().required(),
            pages: Joi.array().items(Joi.object({
              pageId: Joi.objectId().required(),
              page_type: Joi.string().required(),
              rotateByDegree: Joi.number().default(0).optional(),
              ocrStrategy: Joi.string().valid("A", "B", "C", "Z", "O", "P", "").optional()
            })).optional(),
            docNumber: Joi.number().required()
          }).required(),
          qcFromSupervisorScreen: Joi.boolean().optional()
        })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'update document classification',
    },
    internalErrorMessage: 'reClassifyDocumentsFromFile',
  },
  {
    handler: 'hardResetBatch',
    scope: INDEXER,
    route: `${V1}idp/reset`,
    method: REST_API_METHODS.PUT,
    options: {
      validate: {
        payload: Joi.object({
          idpId: Joi.objectId().required(),
          fileName: Joi.string().optional(),
        })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'reset Batch',
    },
    internalErrorMessage: 'hardResetBatch',
  },
  {
    handler: 'moveFilesBetweenBatches',
    scope: INDEXER,
    route: `${V1}idp/moveFile`,
    method: REST_API_METHODS.PUT,
    options: {
      validate: {
        payload: Joi.object({
          idpId: Joi.objectId().required(),
          newIdpId: Joi.objectId().required(),
          fileName: Joi.string().required(),
        })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'reset Batch',
    },
    internalErrorMessage: 'hardResetBatch',
  },
  {
    handler: 'deleteFile',
    scope: INDEXER,
    route: `${V1}file`,
    method: REST_API_METHODS.DELETE,
    options: {
      validate: {
        payload: Joi.object({
          idpId: Joi.objectId().required(),
          fileName: Joi.string().required()
        })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['batch', 'api'],
      description: 'delete file',
    },
    internalErrorMessage: 'deleteFile',
  },
];

// doc routes
const ROUTES_DOC_MOD = [
  // [Route]- fetch documents list
  {
    method: 'GET',
    route: `${V1}documents`,
    handler: 'documentList',
    options: {
      validate: {
        query: DOCUMENT_SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document list',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'documentList',
  },
  // [Route]- fetch documents detail
  {
    method: 'GET',
    route: `${V1}documents/{id}`,
    handler: 'documentDetail',
    options: {
      validate: {
        params: ID_SCHEMA,
        query: Joi.object({ qcFromSupervisorScreen: Joi.boolean().optional() })
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document detail',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'documentDetail',
  },
  // [Route]- update documents detail
  {
    method: 'PUT',
    route: `${V1}documents/{id}`,
    handler: 'documentUpdate',
    options: {
      timeout: { server: 1000 * 60 * 10 },
      payload: {
        maxBytes: MAX_UPLOAD_LIMIT * 40,
        timeout: 1000 * 60 * 10
      },
      validate: {
        params: ID_SCHEMA,
        payload: DOCUMENT_UPDATE_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document update',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'documentUpdate',
  },
  // [Route]- update documents detail
  {
    method: 'PUT',
    route: `${V1}documentsForceUpdate/{id}`,
    handler: 'documentsForceUpdate',
    options: {
      timeout: { server: 1000 * 60 * 10 },
      payload: {
        maxBytes: MAX_UPLOAD_LIMIT * 40,
        timeout: 1000 * 60 * 10
      },
      validate: {
        params: ID_SCHEMA,
        payload: DOCUMENT_UPDATE_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'document update',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'documentUpdate',
  },
  // [Route]- delete documents
  {
    method: 'DELETE',
    route: `${V1}documents`,
    handler: 'dcoumentDelete',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'document delete',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'dcoumentDelete',
  },
  {
    method: 'PUT',
    route: `${V1}documents/assign`,
    handler: 'documentAssign',
    options: {
      validate: {
        payload: DOCUMENT_ASSIGN_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'document assign',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'documentAssign',
  },
  {
    method: 'GET',
    route: `${V1}documents/assign`,
    handler: 'fetchDocumentAssign',
    options: {
      validate: {
        query: SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'document assign',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'fetchDocumentAssign',
  },
  // [Route]- download files as zip
  {
    method: 'POST',
    route: `${V1}documents/createDownloadLink`,
    handler: 'createDownloadLink',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'idp download',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'createDownloadLink',
  },
  // [Route]- download files as zip
  {
    method: 'GET',
    route: `${V1}documents/snipplets`,
    handler: 'documentSnipplets',
    options: {
      validate: {
        query: DOCUMENT_SNIPPLET_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document snipplets',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'documentSnipplets',
  },
  {
    method: 'PUT',
    route: `${V1}documents/tableCompletion`,
    handler: 'tableCompletion',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document tableCompletion',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'tableCompletion',
  },
  {
    method: 'PUT',
    route: `${V1}documents/autoTableCompletion`,
    handler: 'autoTableCompletion',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document autoTableCompletion',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'autoTableCompletion',
  },
  {
    method: 'PUT',
    route: `${V1}documents/fieldCompletion`,
    handler: 'fieldCompletion',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document fieldCompletion',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'fieldCompletion',
  },
  // [Route]- vendor corrections
  {
    method: 'GET',
    route: `${V1}documents/vendorCorrection`,
    handler: 'documentsVendorCorrection',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'document VendorCorrection',
      tags: ['admin', 'api'],
    },
    internalErrorMessage: 'documentsVendorCorrection',
  },
  {
    method: 'PUT',
    route: `${V1}documents/qc/{id}`,
    handler: 'documentQc',
    options: {
      validate: {
        params: ID_SCHEMA,
        payload: DOCUMENT_QC_SCHEMA
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document qc',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'documentQc',
  },
  // [Route]- download mapping as JSON/CSV
  {
    method: 'POST',
    route: `${V1}documents/download/mapping`,
    handler: 'docRetrieveMapping',
    options: {
      validate: {
        payload: DOC_MAPPING_DOWNLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'document retrieve',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'docRetrieveMapping',
  },
  {
    method: 'GET',
    route: `${V1}documents/buckets/{id}`,
    handler: 'bucketizationDocuments',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document bucket creation',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'Bucketization Documents',
  },
  {
    method: 'GET',
    route: `${V1}imc/documents`,
    handler: 'documentListIMC',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      validate: {
        query: IMC_DOCUMENT_SEARCH_SCHEMA,
      },
      description: 'fetch documents',
      tags: ['imc', 'api'],
    },
  },
  // [Route]- download documnt file
  {
    method: 'GET',
    route: `${V1}documents/download`,
    handler: 'downloadDocumentFile',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      validate: {
        query: Joi.object({ _id: Joi.objectId().required(), disablePurging: Joi.boolean().default(true) })
      },
      description: 'document file download',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'downloadDocumentFile',
  },
  // [Route]- download documnt file
  {
    method: 'PATCH',
    route: `${V1}startFileReview`,
    handler: 'startFileReview',
    options: {
      validate: {
        payload: Joi.object({ idpId: Joi.objectId().required(), fileName: Joi.string().required(), release: Joi.boolean().optional() }),
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      description: 'document file download',
      tags: ['document', 'api'],
    },
    internalErrorMessage: 'downloadDocumentFile',
  }
];

// training routes
const ROUTES_TRAINING_MOD = [
  /**
    {
     method: 'POST',
     route: `${V1}training/upload`,
     handler: 'processUpload',
     options: {
       payload: {
         output: 'stream',
         parse: true,
         allow: 'multipart/form-data',
         multipart: true,
         maxBytes: MAX_UPLOAD_LIMIT,
       },
       validate: {
         payload: TRAINING_PAYLOAD_UPLOAD_SCHEMA,
       },
       plugins: {
         'hapi-swagger': {
           payloadType: 'form',
         },
       },
       auth: {
         strategy: AUTH_STRATEGIES.API_AUTH,
         access: [
           {
             scope: ENTERPRISE,
           },
         ],
       },
       tags: ['training', 'api'],
       description: 'uploaded training doc',
     },
     internalErrorMessage: 'upload-uploaded docs',
   },
   {
     method: REST_API_METHODS.GET,
     route: `${V1}training`,
     handler: 'trainingList',
     options: {
       validate: {
         query: SEARCH_SCHEMA,
       },
       auth: {
         strategy: AUTH_STRATEGIES.API_AUTH,
         access: [
           {
             scope: ENTERPRISE,
           },
         ],
       },
       tags: ['training', 'api'],
       description: 'fetch training list',
     },
     internalErrorMessage: 'fetch-training list',
   },
   {
     method: REST_API_METHODS.GET,
     route: `${V1}training/docs`,
     handler: 'trainingDocList',
     options: {
       validate: {
         query: SEARCH_SCHEMA,
       },
       auth: {
         strategy: AUTH_STRATEGIES.API_AUTH,
         access: [
           {
             scope: ENTERPRISE,
           },
         ],
       },
       tags: ['training', 'api'],
       description: 'fetch training docs',
     },
     internalErrorMessage: 'fetch-training docs',
   }, */
  {
    method: REST_API_METHODS.GET,
    route: `${V1}training/docs/{id}`,
    handler: 'trainingDocDetail',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'training doc detail',
    },
    internalErrorMessage: 'training-doc detail',
  },
  /**
   {
    method: REST_API_METHODS.DELETE,
    route: `${V1}training`,
    handler: 'trainingDelete',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'delete training',
    },
    internalErrorMessage: 'delete-training',
  },
 {
    method: REST_API_METHODS.DELETE,
    route: `${V1}training/docs`,
    handler: 'trainingDocDelete',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'delete training docs',
    },
    internalErrorMessage: 'delete-training docs',
  }, */
  {
    method: REST_API_METHODS.POST,
    route: `${V1}training/retrain`,
    handler: 'trainingManual',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'manual training',
    },
    internalErrorMessage: 'training-manual',
  },
  {
    method: REST_API_METHODS.POST,
    route: `${V1}training/ocr`,
    handler: 'trainingOcr',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'training ocr',
    },
    internalErrorMessage: 'training ocr',
  },
  {
    method: REST_API_METHODS.PUT,
    route: `${V1}training/non-tabular/{id}`,
    handler: 'trainingNonTabular',
    options: {
      validate: {
        payload: TRAINING_NON_TABULAR_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'feedback non-tabular',
    },
    internalErrorMessage: 'training-non-tabular',
  },
  {
    method: REST_API_METHODS.PUT,
    route: `${V1}training/tabular/{id}`,
    handler: 'trainingTabular',
    options: {
      validate: {
        payload: TRAINING_TABULAR_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: INDEXER,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'feedback tabular',
    },
    internalErrorMessage: 'training-tabular',
  },
  {
    method: REST_API_METHODS.DELETE,
    route: `${V1}training/documents/{id}/page/{pageNo}`,
    handler: 'trainingDocKeysDelete',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
        params: TRAINING_KEY_VALUES_PARAMS_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      tags: ['training', 'api'],
      description: 'training keys delete',
    },
    internalErrorMessage: 'training keys delete',
  },
];

// logs routes
const ROUTES_LOGS_MOD = [
  {
    handler: 'applicationLogs',
    scope: ENTERPRISE,
    route: `${V1}logs/application`,
    method: REST_API_METHODS.GET,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'application logs',
      tags: ['logs', 'api'],
    },
    internalErrorMessage: 'applicationLogs',
  },
];

// admin routes
const ROUTES_ADMIN_MOD = [
  // [Route]- fetch users
  {
    method: 'GET',
    route: `${V1}admin/users`,
    handler: 'userList',
    options: {
      validate: {
        query: SEARCH_ADMIN_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'user list',
      tags: ['admin', 'api'],
    },
  },
  // [Route]- fetch users detail
  {
    method: 'GET',
    route: `${V1}admin/users/{id}`,
    handler: 'userDetail',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'user list',
      tags: ['admin', 'api'],
    },
  },
  // [Route]- create users
  {
    method: 'POST',
    route: `${V1}admin/users`,
    handler: 'userCreate',
    options: {
      validate: {
        payload: ADMIN_USER_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'user create',
      tags: ['admin', 'api'],
    },
  },
  // [Route]- update users
  {
    method: 'PUT',
    route: `${V1}admin/users/{id}`,
    handler: 'userUpdate',
    options: {
      validate: {
        params: {
          id: Joi.objectId().required().description('Enter a valid id'),
        },
        payload: ADMIN_USER_UPDATE_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'user update',
      tags: ['admin', 'api'],
    },
  },
  // [Route]- delte users
  {
    method: 'DELETE',
    route: `${V1}admin/users/{id}`,
    handler: 'userDelete',
    options: {
      validate: {
        params: ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'user delete',
      tags: ['admin', 'api'],
    },
  },
  {
    method: 'GET',
    route: `${V1}admin/users/workflow/{tenantId}`,
    handler: 'userWorkFlowList',
    options: {
      validate: {
        params: TENANT_ID_SCHEMA,
        query: SEARCH_SCHEMA
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'user list',
      tags: ['admin', 'api'],
    },
  },
];

// rule routes
const ROUTES_RULE_MOD = [
  // [Route]- fetch rule
  {
    method: 'GET',
    route: `${V1}rules`,
    handler: 'fetchRule',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'fetch rule',
      tags: ['rules', 'api'],
    },
  },
  // [Route]- update rule
  {
    method: 'PUT',
    route: `${V1}rules`,
    handler: 'updateRule',
    options: {
      validate: {
        payload: RULE_ENGINE_PAYLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'update rule',
      tags: ['rules', 'api'],
    },
  },
];

const ROUTES_STATS_MOD = [
  {
    method: 'GET',
    route: `${V1}stats`,
    handler: 'stats',
    options: {
      validate: {
        query: STATS_QUERY_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'fetch stats',
      tags: ['statistics', 'api'],
    },
  },
];

const ROUTES_HEALTH_MOD = [
  {
    method: 'GET',
    route: `${V1}server/health`,
    handler: 'health',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ],
      },
      description: 'fetch server health',
      tags: ['health', 'api'],
    },
  },
];

// rule routes
const ROUTES_CRED_MOD = [
  // [Route]- credentails
  {
    method: 'GET',
    route: `${V1}imc/creds`,
    handler: 'fetchCredentials',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      validate: {
        query: CREDENTIALS_SEARCH_SCHEMA,
      },
      description: 'fetch cred',
      tags: ['imc', 'api'],
    },
  },
  {
    method: 'POST',
    route: `${V1}creds`,
    handler: 'createCredentials',
    options: {
      validate: {
        payload: CREDENTIALS_PAYLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'create cred',
      tags: ['creds', 'api'],
    },
  },
  {
    method: 'PUT',
    route: `${V1}creds/{id}`,
    handler: 'updateCredentials',
    options: {
      validate: {
        payload: CREDENTIALS_PAYLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'update cred',
      tags: ['creds', 'api'],
    },
  },
  {
    method: 'DELETE',
    route: `${V1}creds/{id}`,
    handler: 'deleteCredentials',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'delete cred',
      tags: ['creds', 'api'],
    },
  },
];

const ROUTES_IMC_MOD = [
  {
    method: 'PUT',
    route: `${V1}imc/globalmapping`,
    handler: 'updateGlobalMapping',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      validate: {
        payload: IMC_GLOBAL_MAPPING_PAYLOAD_UPDATE_SCHEMA,
      },
      description: 'update global mapping',
      tags: ['imc', 'api'],
    },
  },
  {
    method: 'PUT',
    route: `${V1}imc/ocr/demo`,
    handler: 'updateDemoOcr',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      validate: {
        payload: IMC_OCR_UPDATE_URL_SCHEMA,
      },
      description: 'update demo ocr',
      tags: ['imc', 'api'],
    },
  },
  {
    method: 'GET',
    route: `${V1}imc/ocr/demo`,
    handler: 'fetchDemoOcr',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'check Demo ocr data',
      tags: ['imc', 'api'],
    },
  },
  // [Route]- fetch all globalMapping IMC
  {
    method: REST_API_METHODS.GET,
    route: `${V1}globalMapping/ocr`,
    handler: 'mappingFetchIMC',
    options: {
      validate: {
        query: SEARCH_SCHEMA_OCR,
      },
      tags: ['imc', 'api'],
      description: 'fetch mapping imc',
    },
    internalErrorMessage: 'fetch mapping imc',
  },
  {
    method: 'DELETE',
    route: `${V1}imc/users`,
    handler: 'userDeleteIMC',
    options: {
      validate: {
        payload: MULTIPLE_OBJECT_ID_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'user delete imc',
      tags: ['imc', 'api'],
    },
    internalErrorMessage: 'userDeleteIMC',
  },
  {
    method: 'PUT',
    route: `${V1}imc/users/{id}`,
    handler: 'userUpdateIMC',
    options: {
      validate: {
        params: ID_SCHEMA,
        payload: IMC_USER_UPDATE_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'user update imc',
      tags: ['imc', 'api'],
    },
    internalErrorMessage: 'userUpdateIMC',
  },
  {
    method: 'POST',
    route: `${V1}imc/ocr/document`,
    handler: 'updateDocumentOcr',
    options: {
      timeout: { server: 1000 * 60 * 60 },
      payload: {
        maxBytes: MAX_UPLOAD_LIMIT * 40,
        timeout: 1000 * 60 * 60
      },
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'update demo ocr',
      tags: ['imc', 'api'],
    },
  },
  {
    method: 'POST',
    route: `${V1}imc/ocr/documentKeyExtract`,
    handler: 'updateDocumentOnRotationOcr',
    options: {
      timeout: { server: 1000 * 60 * 60 },
      payload: {
        maxBytes: MAX_UPLOAD_LIMIT * 40,
        timeout: 1000 * 60 * 60
      },
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'update demo ocr',
      tags: ['imc', 'api'],
    },
  },
  {
    method: 'GET',
    route: `${V1}imc/ocr/aiServers`,
    handler: 'aiServerMapping',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'fetch ocr server mapings data',
      tags: ['imc', 'api'],
    },
  },
  {
    method: 'GET',
    route: `${V1}imc/fetchVendorList`,
    handler: 'fetchVendorList',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'fetch vendor list',
      tags: ['imc', 'api'],
    },
  },
  {
    method: 'POST',
    route: `${V1}imc/documentVendor`,
    handler: 'updateDocumentVendor',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'update demo ocr',
      tags: ['imc', 'api'],
    },
  },
];

// API FOR AI
const ROUTES_AI_API = [
  // GET DATA
  {
    method: 'POST',
    route: `${V1}ai/fetchTableData`,
    handler: 'getData',
    // plugins: {
    //   payloadType: 'json',
    // },
    options: {
      validate: {
        payload: FETCH_DATA_FOR_AI,
      },
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'fetch data from tables',
      tags: ['ai', 'api'],
    },
  },
  // COUNT DATA
  {
    method: 'POST',
    route: `${V1}ai/countTableData`,
    handler: 'count',
    options: {
      validate: {
        payload: COUNT_DATA_FOR_AI,
      },
      auth: {
        strategy: AUTH_STRATEGIES.SIMPLE,
      },
      description: 'count data from tables',
      tags: ['ai', 'api'],
    },
  },
  // CREATE DATA
  // {
  //   method: 'GET',
  //   route: `${V1}ai/createTableData`,
  //   handler: 'create',
  //   options: {
  //     auth: {
  //       strategy: AUTH_STRATEGIES.API_AUTH,
  //     },
  //     validate: {
  //       query: FETCH_DATA_FOR_AI,
  //     },
  //     description: 'CREATE data from tables',
  //     tags: ['ai', 'api'],
  //   },
  // },
  // // UPDATE DATA
  // {
  //   method: 'GET',
  //   route: `${V1}ai/updateTableData`,
  //   handler: 'update',
  //   options: {
  //     auth: {
  //       strategy: AUTH_STRATEGIES.API_AUTH,
  //     },
  //     validate: {
  //       query: FETCH_DATA_FOR_AI,
  //     },
  //     description: 'UPDATE data from tables',
  //     tags: ['ai', 'api'],
  //   },
  // },
  // // DELETE DATA
  // {
  //   method: 'GET',
  //   route: `${V1}ai/deleteTableData`,
  //   handler: 'delete',
  //   options: {
  //     auth: {
  //       strategy: AUTH_STRATEGIES.API_AUTH,
  //     },
  //     validate: {
  //       query: FETCH_DATA_FOR_AI,
  //     },
  //     description: 'DELETE data from tables',
  //     tags: ['ai', 'api'],
  //   },
  // },
]

module.exports = {
  ROUTES_RATE_LIMIT_MOD,
  ROUTES_AUTH_MOD,
  ROUTES_ROLE_MOD,
  ROUTES_USER_MOD,
  ROUTES_ADMIN_MOD,
  ROUTES_LOGS_MOD,
  ROUTES_CONFIG_MOD,
  ROUTES_GLOBAL_MAPPING_MOD,
  ROUTES_IDP_MOD,
  ROUTES_DOC_MOD,
  ROUTES_TRAINING_MOD,
  ROUTES_RULE_MOD,
  ROUTES_STATS_MOD,
  ROUTES_HEALTH_MOD,
  ROUTES_CRED_MOD,
  ROUTES_IMC_MOD,
  ROUTES_AI_API
};
