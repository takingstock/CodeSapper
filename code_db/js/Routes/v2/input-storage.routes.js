const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { inputStorageController } = require('../../Controllers');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_LIST = ROLES.LIST

const fetchInputStorages = (request) => new Promise((resolve, reject) => {
    inputStorageController.fetchInputStorages(
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
const inputStorageDetail = (request) => new Promise((resolve, reject) => {
    inputStorageController.inputStorageDetail(
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
const createInputStorage = (request) => new Promise((resolve, reject) => {
    inputStorageController.createInputStorage(
        request.auth.credentials.user,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})
const updateInputStorage = (request) => new Promise((resolve, reject) => {
    inputStorageController.updateInputStorage(
        request.auth.credentials.user,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})

const deleteInputStorage = (request) => new Promise((resolve, reject) => {
    inputStorageController.deleteInputStorage(
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
const verifyInputStorage = (request) => new Promise((resolve, reject) => {
    inputStorageController.verifyInputStorage(
        request.auth.credentials.user,
        request.payload,
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
    path: `${V2}inputStorages`,
    handler: fetchInputStorages,
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
            query: Joi.object({ tenantId: Joi.objectId().optional() })
        },
        description: 'List input storage',
        tags: ['Input Storage', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}inputStorage`,
    handler: inputStorageDetail,
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
            query: Joi.object({ inputStorageId: Joi.objectId().required() })
        },
        description: 'input storage detail',
        tags: ['Input Storage', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}inputStorage`,
    handler: createInputStorage,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_SADMIN_TENANT,
                },
            ]
        },
        validate: {
            payload: Joi.object({
                name: Joi.string().required(),
                type: Joi.string().valid("LOCAL", "S3").required(),
                folderPath: Joi.string().required(),
                accessKeyId: Joi.string().optional(),
                secretAccessKey: Joi.string().optional(),
                bucketName: Joi.string().optional(),
                region: Joi.string().optional()
            })
        },
        description: 'Create new input storage',
        tags: ['Input Storage', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}inputStorage`,
    handler: updateInputStorage,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_SADMIN_TENANT,
                },
            ]
        },
        validate: {
            payload: Joi.object({
                inputStorageId: Joi.objectId().required(),
                name: Joi.string().required(),
                type: Joi.string().valid("LOCAL", "S3").required(),
                folderPath: Joi.string().required(),
                accessKeyId: Joi.string().optional(),
                secretAccessKey: Joi.string().optional(),
                bucketName: Joi.string().optional(),
                region: Joi.string().optional()
            })
        },
        description: 'Update details of input storage',
        tags: ['Input Storage', 'api'],
    }
},
{
    method: 'DELETE',
    path: `${V2}inputStorage`,
    handler: deleteInputStorage,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_SADMIN_TENANT,
                },
            ]
        },
        validate: {
            query: Joi.object({ inputStorageId: Joi.objectId().required() })
        },
        description: 'Remove input storage',
        tags: ['Input Storage', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}verifyInputStorage`,
    handler: verifyInputStorage,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ROLES_SADMIN_TENANT,
                },
            ]
        },
        validate: {
            payload: Joi.object({ inputStorageId: Joi.objectId().required() })
        },
        description: 'Verify input storage',
        tags: ['Input Storage', 'api']
    }
},
];
