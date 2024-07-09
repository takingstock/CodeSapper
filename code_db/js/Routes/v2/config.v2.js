const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { saveLogs } = require('../../Controllers/process-ocr.controller')
const {
  WORKFLOW_CREATE_PAYLOAD_SCHEMA,
  WORKFLOW_UPDATE_PAYLOAD_SCHEMA,
  WORKFLOW_VALIDATE_PAYLOAD_SCHEMA,
  WORKFLOW_SEARCH_SCHEMA,
  WORKFLOW_PROCESS_PAYLOAD_SCHEMA,
  ID_SCHEMA,
  MULTIPLE_OBJECT_ID_SCHEMA,
  OCR_PAYLOAD_UPLOAD_SCHEMA,
  OCR_QUERY_UPLOAD,
  OCR_SEARCH_SCHEMA,
  OCR_PAYLOAD_KEY_DATA_UPDATE,
  OCR_QUERY_DOCUMENT_LIST,
  OCR_QUERY_DOCUMENT_DETAIL,
  OCR_PAYLOAD_BATCH_CREATION,
  OCR_QUERY_BATCH_LIST,
  OCR_PAYLOAD_KEY_DATA_DELETE,
  OCR_PAYLOAD_BATCH_VARIFY,
  AI_SERVER_PAYLOAD,
  AI_SERVER_ID_SCHEMA,
  ADD_AI_SERVER_TO_WORKFLOW,
  AI_SERVER_SEARCH_SCHEMA,
  ENTERPRISE_USER_SCHEMA,
  ENTERPRISE_USER_GET_SCHEMA,
  USER_UPDATE_SCHEMA,
  TEAMS_USER_SCHEMA,
  GET_TEAMS_DETAILS,
  UPDATE_TEAM_USER_SCHEMA,
  DELETE_TEAM_SCHEMA,
  DELETE_ALL_TEAM_MEMBERS_SCHEMA,
  DELETE_USER,
  CUSTOMERS_TEAM_SCHEMA,
  REPORT_GENERATION_FOR_DEBUG_LOGS,
  GET_DEBUG_LOGS_SCHEMA,
  FETCH_QUEUE_LOGS,
  REPORT_GENERATION_FOR_QUEUE_LOGS,
} = require('../../Validations');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
const ALL_USERS = [...ROLES.LIST]
// const SUPERVISOR = [...ENTERPRISE, ROLES.SUPERVISOR]
// const INDEXER = [...SUPERVISOR, ROLES.INDEXER];
const V2 = config.get('API.V2');
const REST_API_METHODS = config.get('REST_API_METHODS');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const MAX_UPLOAD_LIMIT = config.get('SERVER.MAX_UPLOAD_LIMIT');
const WORKFLOW_MODULE = [
  {
    method: REST_API_METHODS.GET,
    route: `${V2}workflows`,
    handler: 'fetchWorkflow',
    options: {
      validate: {
        query: WORKFLOW_SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'fetch workflow',
      tags: ['workflow', 'api'],
    },
    internalErrorMessage: 'roleDetail',
  },
  {
    method: REST_API_METHODS.POST,
    route: `${V2}workflows`,
    handler: 'createWorkflow',
    options: {
      validate: {
        payload: WORKFLOW_CREATE_PAYLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'create workflow',
      tags: ['workflow', 'api'],
    },
    internalErrorMessage: 'roleDetail',
  },
  {
    method: REST_API_METHODS.PUT,
    route: `${V2}workflows/{id}`,
    handler: 'updateWorkflow',
    options: {
      validate: {
        payload: WORKFLOW_UPDATE_PAYLOAD_SCHEMA,
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
      description: 'update workflow',
      tags: ['workflow', 'api'],
    },
    internalErrorMessage: 'roleDetail',
  },
  {
    method: REST_API_METHODS.PUT,
    route: `${V2}workflows/validate/{id}`,
    handler: 'validateWorkflow',
    options: {
      validate: {
        payload: WORKFLOW_VALIDATE_PAYLOAD_SCHEMA,
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
      description: 'validate workflow',
      tags: ['workflow', 'api'],
    },
    internalErrorMessage: 'validateWorkflow',
  },
  {
    method: REST_API_METHODS.GET,
    route: `${V2}workflows/{id}`,
    handler: 'fetchWorkflowById',
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
      description: 'fetch workflow by ID',
      tags: ['workflow', 'api'],
    },
    internalErrorMessage: 'roleDetail',
  },
  {
    method: 'DELETE',
    route: `${V2}workflows`,
    handler: 'workflowDelete',
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
      description: 'workflow delete',
      tags: ['workflow', 'api'],
    },
    internalErrorMessage: 'userDelete',
  },
  {
    method: REST_API_METHODS.POST,
    route: `${V2}workflows/process`,
    handler: 'processWorkflow',
    options: {
      validate: {
        payload: WORKFLOW_PROCESS_PAYLOAD_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'process workflow',
      tags: ['workflow', 'api'],
    },
    internalErrorMessage: 'processWorkflow',
  },
];

const OCR_MODULE_NEW = [
  {
    handler: 'processOcrUpload',
    route: `${V2}ocrProcess`,
    method: REST_API_METHODS.POST,
    options: {
      timeout: { server: 1000 * 60 * 60 },
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data',
        multipart: true,
        maxBytes: MAX_UPLOAD_LIMIT * 40,
        timeout: 1000 * 60 * 60
      },
      validate: {
        payload: OCR_PAYLOAD_UPLOAD_SCHEMA,
        query: OCR_QUERY_UPLOAD,
        failAction: (request, h, err) => {
          const logs = {
            workflowId: (request.payload && request.payload.workflowId) || null,
            tenantId: request.auth && request.auth.credentials && request.auth.credentials.user && request.auth.credentials.user.tenantId,
            ipAddress: request.headers['x-real-ip'] || request.info.remoteAddress,
            endpoint: request && request.route && request.route.path,
            method: request && request.route && request.route.method,
            requestTime: new Date().getTime(),
            responseTime: new Date().getTime()
          }
          console.log("LOG SAVED on faile action /ocrProcess :", logs)
          saveLogs(logs, (err.output && err.output.statusCode) || err.statusCode || err.code || 500, err, {}, () => { })
          return err
        }
      },
      plugins: {
        'hapi-swagger': {
          payloadType: 'form',
        },
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_KEY_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      tags: ['Ocr', 'api'],
      description: 'process Ocr via file  Upload',
    },
    internalErrorMessage: 'Ocr process',
  },
  {
    handler: 'processOcrUploadInbackground',
    route: `${V2}processOcrUpload`,
    method: REST_API_METHODS.POST,
    options: {
      timeout: { server: 1000 * 60 * 60 },
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data',
        multipart: true,
        maxBytes: MAX_UPLOAD_LIMIT * 40,
        timeout: 1000 * 60 * 60
      },
      validate: {
        payload: OCR_PAYLOAD_UPLOAD_SCHEMA,
        query: OCR_QUERY_UPLOAD,
        failAction: (request, h, err) => {
          const logs = {
            workflowId: (request.payload && request.payload.workflowId) || null,
            tenantId: request.auth && request.auth.credentials && request.auth.credentials.user && request.auth.credentials.user.tenantId,
            ipAddress: request.headers['x-real-ip'] || request.info.remoteAddress,
            endpoint: request && request.route && request.route.path,
            method: request && request.route && request.route.method,
            requestTime: new Date().getTime(),
            responseTime: new Date().getTime()
          }
          console.log("LOG SAVED on faile action /processOcrUpload :", logs)
          saveLogs(logs, (err.output && err.output.statusCode) || err.statusCode || err.code || 500, err, {}, () => { })
          return err
        }
      },
      plugins: {
        'hapi-swagger': {
          payloadType: 'form',
        },
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_KEY_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      tags: ['External APIs', 'api'],
      description: 'process ocr bulk upload checks status with status api',
    },
    internalErrorMessage: 'processOcrUpload',
  },
  {
    handler: 'uploadedBatchStatus',
    route: `${V2}ocrUploadStatus`,
    method: REST_API_METHODS.GET,
    options: {
      validate: {
        query: Joi.object({ batch_id: Joi.string().required(), doc_id: Joi.string().optional() }),
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_KEY_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      tags: ['External APIs', 'api'],
      description: 'Ocr Upload status',
    },
    internalErrorMessage: 'OcrUploadStatus',
  },
  {
    handler: 'listApiEndpoints',
    route: `${V2}endpoints`,
    method: REST_API_METHODS.GET,
    options: {
      plugins: {
        customers: true
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      validate: {
        query: Joi.object({ type: Joi.string().optional(), workflowId: Joi.objectId().required() }),
      },
      tags: ['Ocr', 'api'],
      description: 'List Api Endpoints',
    },
    internalErrorMessage: 'processOcrUpload',
  },
  {
    handler: 'processDocumentDetails',
    route: `${V2}process/document`,
    method: REST_API_METHODS.GET,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      validate: {
        query: OCR_QUERY_DOCUMENT_DETAIL,
      },
      tags: ['Ocr', 'api'],
      description: 'get document details',
    },
    internalErrorMessage: 'processOcrUpload',
  },
  {
    handler: 'processDocumentList',
    route: `${V2}process/documents`,
    method: REST_API_METHODS.GET,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
      },
      validate: {
        query: OCR_QUERY_DOCUMENT_LIST,
      },
      tags: ['Ocr', 'api'],
      description: 'get documents list',
    },
    internalErrorMessage: 'processdocumentList',
  },
  {
    handler: 'batchList',
    route: `${V2}process/batchList`,
    method: REST_API_METHODS.GET,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      validate: {
        query: OCR_QUERY_BATCH_LIST,
      },
      tags: ['Ocr', 'api'],
      description: 'get batch list',
    },
    internalErrorMessage: 'batchList',
  },
  {
    handler: 'createbatch',
    route: `${V2}process/generateBatch`,
    method: REST_API_METHODS.POST,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      validate: {
        payload: OCR_PAYLOAD_BATCH_CREATION,
      },
      tags: ['Ocr', 'api'],
      description: 'create batch list',
    },
    internalErrorMessage: 'createbatches',
  },
  {
    handler: 'verifyBatch',
    route: `${V2}process/verifyBatch`,
    method: REST_API_METHODS.POST,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      validate: {
        payload: OCR_PAYLOAD_BATCH_VARIFY,
      },
      tags: ['Ocr', 'api'],
      description: 'create batch list',
    },
    internalErrorMessage: 'verifyBatch',
  },
  {
    handler: 'allDocuments',
    route: `${V2}documents`,
    method: REST_API_METHODS.GET,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_KEY_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          }
        ]
      },
      validate: {
        query: Joi.object({
          status: Joi.string().valid('OCR_PENDING', 'OCR_INPROGRESS', 'OCR_COMPLETE', 'OCR_FAILED').default('OCR_COMPLETE').optional(),
          review: Joi.string().valid('PENDING', 'COMPLETED').default('COMPLETED').optional(),
          customerId: Joi.string().optional(),
          offset: Joi.number().positive().allow(0).optional(),
          limit: Joi.number().positive().allow(0).optional(),
          timeStamp: Joi.number().positive().allow(0).optional(),
          fileReviewed: Joi.boolean().optional()
        })
      },
      tags: ['External APIs', 'api'],
      description: 'fetch all documents',
    },
    internalErrorMessage: 'allDocuments',
  },
  {
    method: 'GET',
    route: `${V2}document-download`,
    handler: 'idpApidownloadDocumentFile',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_KEY_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      validate: {
        query: Joi.object({ _id: Joi.objectId().required() })
      },
      description: 'document file download',
      tags: ['External APIs', 'api'],
    },
    internalErrorMessage: 'downloadDocumentFileAPI',
  },
]
const IDP_KEY_MODULE = [
  {
    method: REST_API_METHODS.GET,
    route: `${V2}generateIdpApiKey`,
    handler: 'generateIdpKey',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'get new idp api key',
      tags: ['Ocr', 'api'],
    },
    internalErrorMessage: 'generateIdpKey',
  },
  {
    method: REST_API_METHODS.GET,
    route: `${V2}apiKey`,
    handler: 'fetchApiKey',
    strategy: AUTH_STRATEGIES.API_AUTH,
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Get api key details',
      tags: ['Ocr', 'api'],
    },
    internalErrorMessage: 'generateIdpKey',
  },
  {
    method: REST_API_METHODS.POST,
    route: `${V2}apiKey/update`,
    handler: 'updateKeyData',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      validate: {
        payload: OCR_PAYLOAD_KEY_DATA_UPDATE,
      },
      description: 'add ip from whiteList',
      tags: ['Ocr', 'api'],
    },
    internalErrorMessage: 'updateKeyData',
  },
  {
    method: REST_API_METHODS.POST,
    route: `${V2}apiKey/delete`,
    handler: 'deleteKeyData',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      validate: {
        payload: OCR_PAYLOAD_KEY_DATA_DELETE,
      },
      description: 'remove ip from whiteList',
      tags: ['Ocr', 'api'],
    },
    internalErrorMessage: 'deleteKeyData',
  }
]

const LOGS_MODULE = [
  {
    method: REST_API_METHODS.GET,
    route: `${V2}ocr/logs`,
    handler: 'ocrLogsFetch',
    options: {
      validate: {
        query: OCR_SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'fetch logs',
      tags: ['Ocr', 'api'],
    },
    internalErrorMessage: 'fetchLogs',
  },
  {
    method: REST_API_METHODS.GET,
    route: `${V2}ocr/logsList`,
    handler: 'ocrLogsFetchMark',
    options: {
      validate: {
        query: OCR_SEARCH_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'fetch logs',
      tags: ['Ocr', 'api'],
    },
    internalErrorMessage: 'fetchLogs',
  },
]
const SETTING_MODULE = [
  {
    method: REST_API_METHODS.GET,
    route: `${V2}setting`,
    handler: 'fetchSetting',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Setting',
      tags: ['Setting', 'api'],
    },
    internalErrorMessage: 'setting route',
  },
]

const AI_SERVER_MODULE = [
  {
    method: 'GET',
    route: `${V2}aiServers`,
    handler: 'fetchServers',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ]
      },
      validate: {
        query: AI_SERVER_SEARCH_SCHEMA
      },
      description: 'list ai server',
      tags: ['Ai Server', 'api'],
    },
  },
  {
    method: 'GET',
    route: `${V2}aiServer/{serverId}`,
    handler: 'serverDetails',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ]
      },
      validate: {
        params: AI_SERVER_ID_SCHEMA
      },
      description: 'Fetch ai server details',
      tags: ['Ai Server', 'api'],
    },
  },
  {
    method: 'POST',
    route: `${V2}aiServer`,
    handler: 'createServer',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ]
      },
      validate: {
        payload: AI_SERVER_PAYLOAD,
      },
      description: 'Create ai server for super admin',
      tags: ['Ai Server', 'api'],
    },
  },
  {
    method: 'PUT',
    route: `${V2}aiServer/{serverId}`,
    handler: 'updateServer',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ]
      },
      validate: {
        payload: AI_SERVER_PAYLOAD,
        params: AI_SERVER_ID_SCHEMA
      },
      description: 'Update ai server details ',
      tags: ['Ai Server', 'api'],
    },
  },
  {
    method: 'DELETE',
    route: `${V2}aiServer/{serverId}`,
    handler: 'deleteServer',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ]
      },
      validate: {
        params: AI_SERVER_ID_SCHEMA
      },
      description: 'Delete ai server',
      tags: ['Ai Server', 'api'],
    },
  },
  {
    method: 'PUT',
    route: `${V2}aiServer/workflow`,
    handler: 'addAiServerToWorkflow',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: SUPER_ADMIN,
          },
        ]
      },
      validate: {
        payload: ADD_AI_SERVER_TO_WORKFLOW,
      },
      description: 'add ai server to workflow',
      tags: ['Ai Server', 'api'],
    },
  }
]
const ENTERPRISE_ADMIN_CRUD = [
  // [Route]- create users
  {
    method: 'POST',
    route: `${V2}users/createUsers`,
    handler: 'createUser',
    options: {
      validate: {
        payload: ENTERPRISE_USER_SCHEMA,
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
      tags: ['EnterpriseUsers', 'api'],
    },
    internalErrorMessage: 'createUser',
  },
  {
    method: 'GET',
    route: `${V2}users/getUsers`,
    handler: 'getUser',
    options: {
      validate: {
        query: ENTERPRISE_USER_GET_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'getUser',
      tags: ['EnterpriseUsers', 'api'],
    },
    internalErrorMessage: 'getUser',
  },
  {
    method: 'PUT',
    route: `${V2}users/updateUser/{id}`,
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
      description: 'updateUser',
      tags: ['EnterpriseUsers', 'api'],
    },
    internalErrorMessage: 'updateUser',
  },
  {
    method: 'DELETE',
    route: `${V2}users/deleteUser`,
    handler: 'userDelete',
    options: {
      validate: {
        // params: ID_SCHEMA,
        payload: DELETE_USER,
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
      tags: ['EnterpriseUsers', 'api'],
    },
    internalErrorMessage: 'userDelete',
  },
  {
    method: 'GET',
    route: `${V2}users/getOwnDetails`,
    handler: 'getOwnDetails',
    options: {
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ALL_USERS,
          },
        ],
      },
      description: 'getUser',
      tags: ['EnterpriseUsers', 'api'],
    },
    internalErrorMessage: 'getUser',
  },
]
const ENTERPRISE_ADMIN_TEAMS_CRUD = [
  // CREATE NEW TEAM
  {
    method: 'POST',
    route: `${V2}team/createNewTeam`,
    handler: 'createNewTeam',
    options: {
      validate: {
        payload: TEAMS_USER_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'createNewTeam ',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'createNewTeam',
  },
  // [Route]- update team
  {
    method: 'PUT',
    route: `${V2}team/updateMembersOfTeam`,
    handler: 'updateMembersOfTeam',
    options: {
      validate: {
        payload: UPDATE_TEAM_USER_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Teams update',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'updateTeam',
  },
  {
    method: 'GET',
    route: `${V2}team/getTeamDetails`,
    handler: 'getTeamDetails',
    options: {
      validate: {
        query: GET_TEAMS_DETAILS,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Teams details',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'getTeamDetails',
  },
  {
    method: 'GET',
    route: `${V2}team/getTeamWithCustomerList`,
    handler: 'getTeamWithCustomerList',
    options: {
      validate: {
        query: GET_TEAMS_DETAILS,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: ' Get Teams List',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'getTeamWithCustomerList',
  },
  {
    method: 'DELETE',
    route: `${V2}team/deleteTeam`,
    handler: 'deleteTeam',
    options: {
      validate: {
        query: DELETE_TEAM_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Teams delete',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'deleteUserFromTeam',
  },
  {
    method: 'PUT',
    route: `${V2}team/deleteAllMembersOfTeam`,
    handler: 'deleteAllMembersOfTeam',
    options: {
      validate: {
        payload: DELETE_ALL_TEAM_MEMBERS_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Delete All Team Members',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'deleteAllMembersOfTeam',
  },
  {
    method: 'POST',
    route: `${V2}team/addCustomersToTeam`,
    handler: 'addCustomersToTeam',
    options: {
      validate: {
        payload: CUSTOMERS_TEAM_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Add Customers to Team',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'deleteAllMembersOfTeam',
  },
  {
    method: 'POST',
    route: `${V2}team/deleteCustomersFromTeam`,
    handler: 'deleteCustomersFromTeam',
    options: {
      validate: {
        payload: CUSTOMERS_TEAM_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'Delete Customers From Team',
      tags: ['Teams', 'api'],
    },
    internalErrorMessage: 'deleteAllMembersOfTeam',
  },
]

const DEBUG_LOGS = [
  {
    method: 'GET',
    route: `${V2}fetch/logs`,
    handler: 'fetchLogs',
    options: {
      validate: {
        query: GET_DEBUG_LOGS_SCHEMA,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'fetch logs',
      tags: ['Db Logs', 'api'],
    },
    internalErrorMessage: 'fetchDBLogs',
  },
  {
    method: 'GET',
    route: `${V2}generate/logsReport`,
    handler: 'fetchLogsReport',
    options: {
      validate: {
        query: REPORT_GENERATION_FOR_DEBUG_LOGS,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'fetch logs report',
      tags: ['Db Logs', 'api'],
    },
    internalErrorMessage: 'fetchDBLogsReports',
  }
]

const QUEUE_LOGS = [
  {
    method: 'GET',
    route: `${V2}queue/logs`,
    handler: 'fetchQueueLogs',
    options: {
      validate: {
        query: FETCH_QUEUE_LOGS,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'queue logs',
      tags: ['Queue Log', 'api'],
    },
    internalErrorMessage: 'QueueLogs',
  },
  {
    method: 'GET',
    route: `${V2}generate/queueReport`,
    handler: 'queueLogReport',
    options: {
      validate: {
        query: REPORT_GENERATION_FOR_QUEUE_LOGS,
      },
      auth: {
        strategy: AUTH_STRATEGIES.API_AUTH,
        access: [
          {
            scope: ENTERPRISE,
          },
        ],
      },
      description: 'queue logs report',
      tags: ['Queue Log', 'api'],
    },
    internalErrorMessage: 'fetchDBLogsReports',
  }
]

module.exports = {
  OCR_MODULE_NEW,
  WORKFLOW_MODULE,
  LOGS_MODULE,
  IDP_KEY_MODULE,
  SETTING_MODULE,
  AI_SERVER_MODULE,
  ENTERPRISE_ADMIN_CRUD,
  ENTERPRISE_ADMIN_TEAMS_CRUD,
  DEBUG_LOGS,
  QUEUE_LOGS
};
