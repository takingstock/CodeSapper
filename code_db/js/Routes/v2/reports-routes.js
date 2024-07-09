const config = require('config');
const Joi = require('joi').extend(require('@joi/date'));
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { reportsController } = require('../../Controllers');
const latesReportsController = require('../../Controllers/latest-reports.controller');

const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
// const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_LIST = ROLES.LIST
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');

const getDocLifecycleReport = (request) => new Promise((resolve, reject) => {
    reportsController.getDocLifecycleReport(
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
const getClassificationReport = (request) => new Promise((resolve, reject) => {
    reportsController.getClassificationReport(
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
const getMTDReport = (request) => new Promise((resolve, reject) => {
    reportsController.getMTDReport(
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
const getExtractionReport = (request) => new Promise((resolve, reject) => {
    reportsController.getExtractionReport(
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
const getDailyStats = (request) => new Promise((resolve, reject) => {
    reportsController.getDailyStats(
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
const downloadReport = (request, h) => new Promise((resolve, reject) => {
    reportsController.downloadReport(
        // request.auth.credentials.user,
        request.query,
        (err, result) => {
            if (err) {
                console.error("downloadReport err: ", err);
                return reject(BoomCustomError(err));
            }
            if (result) {
                console.log("Result: ", result);
                resolve(
                    h.file(result.filePath, {
                        filename: result.fileName,
                        confine: false,
                        mode: "attachment",
                    })
                );
            } else {
                resolve(HTTP_ERROR_MESSAGES.FILE_UPLOAD.FILE_NOT_FOUND);
            }
        },
    );
})
const getReportsList = (request) => new Promise((resolve, reject) => {
    reportsController.getReportsList(
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
const getExtractionReportBackup = (request) => new Promise((resolve, reject) => {
    reportsController.getExtractionReportBackup(
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

/** Raise tickets */
const raiseDocLifecycleReportTicket = (request) => new Promise((resolve, reject) => {
    latesReportsController.raiseDocLifecycleReportTicket(
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
const raiseClassificationReportTicket = (request) => new Promise((resolve, reject) => {
    latesReportsController.raiseClassificationReportTicket(
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
const raiseExtractionReportTicket = (request) => new Promise((resolve, reject) => {
    latesReportsController.raiseExtractionReportTicket(
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
const raiseMTDReportTicket = (request) => new Promise((resolve, reject) => {
    latesReportsController.raiseMTDReportTicket(
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
const raiseExtractionReportBackupTicket = (request) => new Promise((resolve, reject) => {
    latesReportsController.raiseExtractionReportBackupTicket(
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
const raiseQueueLogsReportTicket = (request) => new Promise((resolve, reject) => {
    latesReportsController.raiseQueueLogsReportTicket(
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
        path: `${V2}getDocLifecycleReport`,
        handler: getDocLifecycleReport,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional()
                })
            },
            description: 'Get Doc Lifecycle Report',
            tags: ['reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}getClassificationReport`,
        handler: getClassificationReport,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional()
                })
            },
            description: 'Get Classification Report',
            tags: ['reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}getMTDReport`,
        handler: getMTDReport,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional()
                })
            },
            description: 'Get MTD Report',
            tags: ['reports', 'api'],
        }
    }, {
        method: 'GET',
        path: `${V2}getExtractionReport`,
        handler: getExtractionReport,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional(),
                    docType: Joi.string().optional()
                })
            },
            description: 'Get Extractions Report',
            tags: ['reports', 'api'],
        }
    }, {
        method: 'GET',
        path: `${V2}getDailyStats`,
        handler: getDailyStats,
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
                query: Joi.object({
                    date: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                })
            },
            description: 'Get Extractions Report',
            tags: ['reports', 'api'],
        }
    }, {
        method: 'GET',
        path: `${V2}downloadReport`,
        handler: downloadReport,
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
                query: Joi.object({
                    fileName: Joi.string().required(),
                })
            },
            description: 'Download Report',
            tags: ['reports', 'api'],
        }
    }, {
        method: 'GET',
        path: `${V2}getReportsList`,
        handler: getReportsList,
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
                query: Joi.object({
                    pageNo: Joi.number().default(1).min(1).optional(),
                    reportType: Joi.string().default("ALL").valid('DOC_LIFECYCLE', 'EXTRACTION', 'CLASSIFICATION', 'MTD', 'ALL').optional(),
                }).concat(SEARCH_COMMON_SCHEMA)
                // query: SEARCH_COMMON_SCHEMA,
            },
            description: 'Get Report List',
            tags: ['reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}getExtractionReportBackup`,
        handler: getExtractionReportBackup,
        options: {
            auth: {
                strategy: AUTH_STRATEGIES.API_KEY_AUTH,
                access: [
                    {
                        scope: ROLES_LIST,
                    },
                ]
            },
            validate: {
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().optional()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().optional()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    idpId: Joi.objectId().optional(),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional()
                })
            },
            description: 'Get Extractions Report',
            tags: ['reports', 'api'],
        }
    },
    // raise ticket routes
    {
        method: 'GET',
        path: `${V2}raiseDocLifecycleReportTicket`,
        handler: raiseDocLifecycleReportTicket,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional(),
                    docType: Joi.string().optional()
                })
            },
            description: 'Get Extractions Report',
            tags: ['Ticket Reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}raiseClassificationReportTicket`,
        handler: raiseClassificationReportTicket,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional(),
                    docType: Joi.string().optional()
                })
            },
            description: 'Get Extractions Report',
            tags: ['Ticket Reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}raiseExtractionReportTicket`,
        handler: raiseExtractionReportTicket,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional(),
                    docType: Joi.string().optional()
                })
            },
            description: 'Get Extractions Report',
            tags: ['Ticket Reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}raiseMTDReportTicket`,
        handler: raiseMTDReportTicket,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional(),
                    docType: Joi.string().optional()
                })
            },
            description: 'Get Extractions Report',
            tags: ['Ticket Reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}raiseExtractionReportBackupTicket`,
        handler: raiseExtractionReportBackupTicket,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional(),
                    docType: Joi.string().optional()
                })
            },
            description: 'Get Extractions Report',
            tags: ['Ticket Reports', 'api'],
        }
    },
    {
        method: 'GET',
        path: `${V2}raiseQueueLogsReportTicket`,
        handler: raiseQueueLogsReportTicket,
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
                query: Joi.object({
                    startDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    endDate: Joi.date().format("DD-MM-YYYY").raw().required()
                        .description("DD-MM-YYYY"),
                    sendResponseAsJson: Joi.boolean().required().default(false)
                        .description("Send response as JSON and not as excel"),
                    sendCombinedMail: Joi.boolean().required().default(false),
                    tenantName: Joi.string().valid("sowmya", "mark_buckley").optional(),
                })
            },
            description: 'Get Extractions Report',
            tags: ['Ticket Reports', 'api'],
        }
    }
];
