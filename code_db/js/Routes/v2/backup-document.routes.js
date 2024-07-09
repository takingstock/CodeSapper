const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const backupDocumentController = require('../../Controllers/backup-document.controller');
const cellInfoMetaDataController = require('../../Controllers/cell-info-metaData.contorller')
// const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');
const splitFileController = require('../../Controllers/splitFile.controller')

const ERR_MESSAGES = config.get('ERR_MESSAGES');
const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_SUPERVISOR = [...ROLES_SADMIN_TENANT, ROLES.SUPERVISOR]

const ROLES_LIST = ROLES.LIST
const MAX_UPLOAD_LIMIT = config.get('SERVER.MAX_UPLOAD_LIMIT');

const getSavedDocumentDetail = (request) => new Promise((resolve, reject) => {
    backupDocumentController.getSavedDocumentDetail(
        request.auth.credentials.user,
        request.params,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})

const saveDocumentDetail = (request) => new Promise((resolve, reject) => {
    backupDocumentController.saveDocumentDetail(
        request.auth.credentials.user,
        request.params,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})
const changeFileStatus = (request) => new Promise((resolve, reject) => {
    splitFileController.changeFileStatus(
        request.auth.credentials.user,
        request.params,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})
const splitFileList = (request) => new Promise((resolve, reject) => {
    splitFileController.splitFileList(
        request.auth.credentials.user,
        request.query,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})
module.exports = [{
    method: 'GET',
    path: `${V2}savedDocument/{docId}`,
    handler: getSavedDocumentDetail,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_LIST,
                },
            ]
        },
        validate: {
            params: Joi.object({ docId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID) })
        },
        description: 'Document auto save',
        tags: ['Document auto save', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}saveDocument/{docId}`,
    handler: saveDocumentDetail,
    options: {
        timeout: { server: 1000 * 60 * 60 },
        payload: {
            maxBytes: MAX_UPLOAD_LIMIT * 40,
            timeout: 1000 * 60 * 60
        },
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_LIST,
                },
            ]
        },
        validate: {
            params: Joi.object({ docId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID) })
        },
        description: 'Document auto save',
        tags: ['Document auto save', 'api'],
    }
},
{
    method: 'PATCH',
    path: `${V2}largeFiles/{docId}`,
    handler: changeFileStatus,
    options: {
        timeout: { server: 1000 * 60 * 60 },
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_SUPERVISOR,
                },
            ]
        },
        validate: {
            params: Joi.object({
                docId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID)
            }),
            payload: Joi.object({
                status: Joi.string().valid('APPROVED', 'REJECTED')
            })
        },
        description: 'change large file status',
        tags: ['Large Files', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}largeFiles`,
    handler: splitFileList,
    options: {
        timeout: { server: 1000 * 60 * 60 },
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_SUPERVISOR,
                },
            ]
        },
        validate: {
            query: Joi.object({
                aiStatus: Joi.string().optional()
            }).concat(SEARCH_COMMON_SCHEMA)
        },
        description: 'large file list',
        tags: ['Large Files', 'api'],
    }
},
];
