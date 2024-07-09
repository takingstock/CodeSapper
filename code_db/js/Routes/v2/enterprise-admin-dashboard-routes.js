const config = require('config');
const Joi = require('joi').extend(require('@joi/date'));
Joi.objectId = require('joi-objectid')(Joi);

const adminDashboardController = require('../../Controllers/enterprise-admin-dashboard.controller');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
// const { ADMIN_DASHBOARD_MODULE } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const statistics = (request) => new Promise((resolve, reject) => {
    adminDashboardController.statistics(
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
const getUploadFilesAiStatus = (request) => new Promise((resolve, reject) => {
    adminDashboardController.getUploadFilesAiStatus(
        request,
        request.query,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        }
    )
})
const setUploadFilesAiStatus = (request) => new Promise((resolve, reject) => {
    adminDashboardController.setUploadFilesAiStatus(
        request,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        }
        )
})

const autoScaling = (request) => new Promise((resolve, reject) => {
    request.payload.ipAddress = request.headers['x-real-ip'] || request.info.remoteAddress || null;
    adminDashboardController.autoScaling(
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

module.exports = [
    {
        method: 'GET',
        path: `${V2}enterprise/statistics`,
        handler: statistics,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_AUTH,
                access: [
                    {
                        scope: ENTERPRISE,
                    },
                ]
            },
            validate: {
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().optional()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().optional()
                        .description("DD-MM-YYYY"),
                    reviewedBy: Joi.objectId().optional().description("user id"),
                    classifiedBy: Joi.objectId().optional().description("user id")
                })
            },
            description: 'enterprise statistics of documents',
            tags: ['Enterprise Admin Dashboard', 'api'],
        },
    },
    {
        method: 'GET',
        path: `${V2}enterprise/filesAiStatus`,
        handler: getUploadFilesAiStatus,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_AUTH,
                access: [
                    {
                        scope: ENTERPRISE,
                    },
                ]
            },
            description: 'check files sending to ai',
            tags: ['Enterprise Admin Dashboard', 'api']
        }
    },
    {
        method: 'PATCH',
        path: `${V2}enterprise/filesAiStatus`,
        handler: setUploadFilesAiStatus,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_AUTH,
                access: [
                    {
                        scope: ENTERPRISE,
                    },
                ]
            },
            validate: {
                payload: Joi.object({ aiProcess: Joi.string().valid("ENABLED", "DISABLED").optional() })
            },
            description: 'statistics of documents',
            tags: ['Enterprise Admin Dashboard', 'api'],
        },
    },
    {
        method: 'PATCH',
        path: `${V2}enterprise/admin/autoScale`,
        handler: autoScaling,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_AUTH,
                access: [
                    {
                        scope: ENTERPRISE,
                    },
                ]
            },
            validate: {
                payload: Joi.object({
                    numberOfServers: Joi.number().required(),
                    scalarType: Joi.string().valid("AWS_AUTO_SCALAR_GROUP_NAME", "S_AWS_AUTO_SCALAR_GROUP_NAME").optional()
                })
            },
            description: 'Auto scale ai servers',
            tags: ['Enterprise Admin Dashboard', 'api'],
        },
    }
];
