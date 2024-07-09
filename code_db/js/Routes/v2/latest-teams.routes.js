const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const latestTeamController = require('../../Controllers/latest-teams.controller');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_LIST = ROLES.LIST

const fetchTeamList = (request) => new Promise((resolve, reject) => {
    latestTeamController.fetchTeamList(
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

const getTeamDetails = (request) => new Promise((resolve, reject) => {
    latestTeamController.getTeamDetails(
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

const createNewTeam = (request) => new Promise((resolve, reject) => {
    latestTeamController.createNewTeam(
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

const updateTeam = (request) => new Promise((resolve, reject) => {
    latestTeamController.updateTeam(
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

const deleteTeam = (request) => new Promise((resolve, reject) => {
    latestTeamController.deleteTeam(
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

const teamsReport = (request) => new Promise((resolve, reject) => {
    latestTeamController.teamsReport(
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
module.exports = [
    {
        method: 'GET',
        path: `${V2}teams`,
        handler: fetchTeamList,
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
                query: Joi.object({ tenantId: Joi.objectId().optional() }).concat(SEARCH_COMMON_SCHEMA)
            },
            description: 'List teams',
            tags: ['Latest Team', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}teams/{teamId}`,
        handler: getTeamDetails,
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
                    teamId: Joi.objectId().required()
                })
            },
            description: 'team detail',
            tags: ['Latest Team', 'api'],
        }
    },
    {
        method: 'POST',
        path: `${V2}team`,
        handler: createNewTeam,
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
                    teamName: Joi.string().required(),
                    customers: Joi.array().optional(),
                    indexers: Joi.array().items(Joi.object({
                        userId: Joi.objectId().required(),
                        reviewPercent: Joi.number().min(0).max(100).optional(),
                    })).optional(),
                    supervisors: Joi.array().items(Joi.object({
                        userId: Joi.objectId().required(),
                    })).optional()
                })
            },
            description: 'Create team',
            tags: ['Latest Team', 'api'],
        }
    },
    {
        method: 'PUT',
        path: `${V2}team/{teamId}`,
        handler: updateTeam,
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
                    teamId: Joi.objectId().required()
                }),
                payload: Joi.object({
                    teamName: Joi.string().optional(),
                    customers: Joi.array().optional(),
                    indexers: Joi.array().items(Joi.object({
                        reviewPercent: Joi.number().min(0).max(100).optional(),
                        userId: Joi.objectId().required(),
                    })).optional(),
                    supervisors: Joi.array().items(Joi.object({
                        userId: Joi.objectId().required(),
                    })).optional()
                })
            },
            description: 'Update details of latest team',
            tags: ['Latest Team', 'api'],
        }
    },
    {
        method: 'DELETE',
        path: `${V2}teams/{teamId}`,
        handler: deleteTeam,
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
                    teamId: Joi.objectId().required()
                }),
            },
            description: 'Remove latest team',
            tags: ['Latest Team', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}teams/report`,
        handler: teamsReport,
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
                query: Joi.object({ tenantId: Joi.objectId().optional() }).concat(SEARCH_COMMON_SCHEMA)
            },
            description: 'List teams report',
            tags: ['Latest Team', 'api'],
        }
    },
];
