const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { externalDbConfigController } = require('../../Controllers');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_LIST = ROLES.LIST

const fetchExternalDbConfigs = (request) => new Promise((resolve, reject) => {
    externalDbConfigController.fetchExternalDbConfigs(
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
const externalDbConfigDetail = (request) => new Promise((resolve, reject) => {
    externalDbConfigController.externalDbConfigDetail(
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
const createExternalDbConfig = (request) => new Promise((resolve, reject) => {
    externalDbConfigController.createExternalDbConfig(
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
const updateExternalDbConfig = (request) => new Promise((resolve, reject) => {
    externalDbConfigController.updateExternalDbConfig(
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

const deleteExternalDbConfig = (request) => new Promise((resolve, reject) => {
    externalDbConfigController.deleteExternalDbConfig(
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

const verifyExternalDbConfig = (request) => new Promise((resolve, reject) => {
    externalDbConfigController.verifyExternalDbConfig(
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
    path: `${V2}dbConfigs`,
    handler: fetchExternalDbConfigs,
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
        description: 'List externalDbConfigs',
        tags: ['Database configuration', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}dbConfig`,
    handler: externalDbConfigDetail,
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
            query: Joi.object({ externalDbConfigId: Joi.objectId().required() })
        },
        description: 'externalDbConfig detail',
        tags: ['Database configuration', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}dbConfig`,
    handler: createExternalDbConfig,
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
                name: Joi.string().optional(),
                dbName: Joi.string().optional(),
                tableName: Joi.string().optional(),
                username: Joi.string().optional(),
                password: Joi.string().optional(),
                url: Joi.string().required(),
                port: Joi.number().optional(),
                dbType: Joi.string().required().valid('mysql', 'postgres', 'sqlite', 'mariadb', 'mssql', 'db2', 'snowflake', 'oracle'),
            })
        },
        description: 'Create new externalDbConfig',
        tags: ['Database configuration', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}dbConfig`,
    handler: updateExternalDbConfig,
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
                externalDbConfigId: Joi.objectId().required(),
                name: Joi.string().optional(),
                dbName: Joi.string().optional(),
                tableName: Joi.string().optional(),
                username: Joi.string().optional(),
                password: Joi.string().optional(),
                url: Joi.string().optional(),
                dbType: Joi.string().optional(),
            })
        },
        description: 'Update details of externalDbConfig',
        tags: ['Database configuration', 'api'],
    }
},
{
    method: 'DELETE',
    path: `${V2}dbsConfig`,
    handler: deleteExternalDbConfig,
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
            query: Joi.object({ externalDbConfigId: Joi.objectId().required() })
        },
        description: 'Remove externalDbConfig',
        tags: ['Database configuration', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}verifyDbConfig`,
    handler: verifyExternalDbConfig,
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
            payload: Joi.object({ externalDbConfigId: Joi.objectId().required() })
        },
        description: 'Create new externalDbConfig',
        tags: ['Database configuration', 'api'],
    }
}
];
