const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);
const { adminDashboardController } = require('../../Controllers');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
// const { ADMIN_DASHBOARD_MODULE } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const statistics = (request) => new Promise((resolve, reject) => {
    adminDashboardController.statistics(
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
    adminDashboardController.setUploadFilesAiStatus(request,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        })
})

const filesListing = (request) => new Promise((resolve, reject) => {
    adminDashboardController.filesListing(
        request,
        request.query,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})
const fileUpdate = (request) => new Promise((resolve, reject) => {
    request.payload.ipAddress = request.headers['x-real-ip'] || request.info.remoteAddress || null;
    adminDashboardController.fileUpdate(
        request,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})
const autoScaling = (request) => new Promise((resolve, reject) => {
    request.payload.ipAddress = request.headers['x-real-ip'] || request.info.remoteAddress || null;
    adminDashboardController.autoScaling(
        request,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})

const setProcessingForTenant = (request) => new Promise((resolve, reject) => {
    adminDashboardController.setProcessingForTenant(request,
        request.payload,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        })
})
const tenants = (request) => new Promise((resolve, reject) => {
    adminDashboardController.tenants(
        request.query, (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})

const reprocessBatch = (request) => new Promise((resolve, reject) => {
    request.payload.ipAddress = request.headers['x-real-ip'] || request.info.remoteAddress || null;
    adminDashboardController.reprocessBatch(
        request,
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
        path: `${V2}statistics`,
        handler: statistics,
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
                query: Joi.object({ tenantId: Joi.objectId().optional(), userId: Joi.objectId().optional() })
            },
            description: 'statistics of documents',
            tags: ['Admin Dashboard', 'api'],
        },
    },
    {
        method: 'GET',
        path: `${V2}filesAiStatus`,
        handler: getUploadFilesAiStatus,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_AUTH,
                access: [
                    {
                        scope: SUPER_ADMIN,
                    },
                ]
            },
            description: 'check files sending to ai',
            tags: ['Admin Dashboard', 'api']
        }
    },
    {
        method: 'PATCH',
        path: `${V2}filesAiStatus`,
        handler: setUploadFilesAiStatus,
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
                payload: Joi.object({ aiProcess: Joi.string().valid("ENABLED", "DISABLED").optional() })
            },
            description: 'statistics of documents',
            tags: ['Admin Dashboard', 'api'],
        },
    },
    {
        method: 'PATCH',
        path: `${V2}admin/file`,
        handler: fileUpdate,
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
                payload:
                    Joi.object({
                        aiStatus: Joi.string().valid("OCR_FAILED", "OCR_PENDING").required(),
                        fileId: Joi.objectId().required()
                    })
            },
            description: 'change file status',
            tags: ['Admin Dashboard', 'api'],
        },
    },
    {
        method: 'GET',
        path: `${V2}admin/filesList`,
        handler: filesListing,
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
                query: Joi.object({
                    aiStatus: Joi.string().valid("OCR_FAILED", "OCR_PENDING", "OCR_INPROGRESS", "OCR_RETRY", "OCR_COMPLETE").required(),
                    classification: Joi.string().valid('STARTED', 'IN_PROGRESS', 'RETRY', 'COMPLETED', 'NOT_REQUIRED').optional(),
                    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'ocrRequestTime', 'ocrResponseTime').optional(),
                }).concat(SEARCH_COMMON_SCHEMA)
            },
            description: 'file listing',
            tags: ['Admin Dashboard', 'api'],
        },
    },
    {
        method: 'PATCH',
        path: `${V2}admin/autoScale`,
        handler: autoScaling,
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
                payload: Joi.object({
                    numberOfServers: Joi.number().required(),
                    scalarType: Joi.string().valid("AWS_AUTO_SCALAR_GROUP_NAME", "S_AWS_AUTO_SCALAR_GROUP_NAME").optional()
                })
            },
            description: 'Auto scale ai servers',
            tags: ['Admin Dashboard', 'api'],
        },
    },
    {
        method: 'PATCH',
        path: `${V2}filesAiProcess`,
        handler: setProcessingForTenant,
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
                payload: Joi.object({
                    tenantName: Joi.string().valid("sowmya", "mark_buckley", "all").optional(),
                    autoSchedular: Joi.string().valid("ENABLED", "DISABLED").optional()
                })
            },
            description: 'enable Ai processing for specific tenant',
            tags: ['Admin Dashboard', 'api'],
        },
    },
    {
        method: 'GET',
        path: `${V2}admin/tenants`,
        handler: tenants,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_AUTH,
                access: [
                    {
                        scope: ENTERPRISE,
                    },
                ]
            },
            description: 'Reprocess batch',
            tags: ['batch', 'api'],
        }
    },
    {
        method: 'PATCH',
        path: `${V2}batch/reprocessBatch`,
        handler: reprocessBatch,
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
                payload:
                    Joi.object({
                        idpId: Joi.objectId().required(),
                        fileName: Joi.string().optional()
                    })
            },
            description: 'Reprocess batch',
            tags: ['batch', 'api'],
        },
    },
];
