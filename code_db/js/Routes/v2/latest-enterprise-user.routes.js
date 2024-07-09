const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const enterpriseUserController = require('../../Controllers/latest-enterprise-user.controller');
const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_LIST = ROLES.LIST
const ERR_MESSAGES = config.get('ERR_MESSAGES');

// [Handler]- Get -user
const fetchUserList = (request) => new Promise((resolve, reject) => {
    enterpriseUserController.fetchUserList(
        request.auth.credentials.user,
        request.query, (err, response) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(response)
        }
    )
})

const fetchUserDetail = (request) => new Promise((resolve, reject) => {
    enterpriseUserController.fetchUserDetail(
        request.auth.credentials.user,
        request.params,
        (err, response) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(response);
        }
    );
})

const createNewUser = (request) => new Promise((resolve, reject) => {
    enterpriseUserController.createNewUser(
        request.auth.credentials.user,
        request.payload,
        (err, response) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(response);
        }
    )
})
// [Handler]- user update
const updateUser = (request) => new Promise((resolve, reject) => {
    enterpriseUserController.updateUser(
        request.auth.credentials.user,
        request.params,
        request.payload,
        (err, response) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(response);
        },
    );
})
// [Handler]- user delete
const deleteUser = (request) => new Promise((resolve, reject) => {
    enterpriseUserController.deleteUser(
        request.auth.credentials.user,
        request.params,
        (err, response) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(response);
        },
    )
})
const userDetails = (request) => new Promise((resolve, reject) => {
    enterpriseUserController.userDetails(
        request.auth.credentials.user,
        (err, response) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(response);
        },
    )
})
module.exports = [
    {
        method: 'GET',
        path: `${V2}enterprise/users`,
        handler: fetchUserList,
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
                query: Joi.object({
                    roleId: Joi.string().optional(),
                    email: Joi.string().optional(),
                }).concat(SEARCH_COMMON_SCHEMA)
            },
            description: 'List Users',
            tags: ['Latest Admin User', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}enterprise/user/{userId}`,
        handler: fetchUserDetail,
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
                params: Joi.object({
                    userId: Joi.objectId().required()
                })
            },
            description: 'User detail',
            tags: ['Latest Admin User', 'api'],
        }
    },
    {
        method: 'POST',
        path: `${V2}enterprise/user`,
        handler: createNewUser,
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
                    firstName: Joi.string().min(2).max(50).required()
                        .description("Enter the firstName"),
                    lastName: Joi.string().min(2).max(50).optional()
                        .description("Enter the lastName"),
                    email: Joi.string().email().required()
                        .description(ERR_MESSAGES.VALID_EMAIL),
                    password: Joi.string().required(),
                    roleId: Joi.objectId().required()
                })
            },
            description: 'Create user',
            tags: ['Latest Admin User', 'api'],
        }
    },
    {
        method: 'PUT',
        path: `${V2}enterprise/user/{userId}`,
        handler: updateUser,
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
                params: Joi.object({
                    userId: Joi.objectId().required()
                }),
                payload: Joi.object({
                    firstName: Joi.string().min(2).max(50).required()
                        .description("Enter the firstName"),
                    lastName: Joi.string().min(2).max(50).optional()
                        .description("Enter the lastName"),
                    email: Joi.string().email().optional()
                        .description(ERR_MESSAGES.VALID_EMAIL),
                    password: Joi.string().optional(),
                    roleId: Joi.objectId().optional()
                })
            },
            description: 'Update details of latest user',
            tags: ['Latest Admin User', 'api'],
        }
    },
    {
        method: 'DELETE',
        path: `${V2}enterprise/user/{userId}`,
        handler: deleteUser,
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
                params: Joi.object({
                    userId: Joi.objectId().required()
                }),
            },
            description: 'Remove latest user',
            tags: ['Latest Admin User', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}enterprise/users/getOwnDetails`,
        handler: userDetails,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_AUTH,
                access: [
                    {
                        scope: ROLES_LIST,
                    },
                ],
            },
            description: 'getUser',
            tags: ['Latest Admin User', 'api'],
        },
    },
];
