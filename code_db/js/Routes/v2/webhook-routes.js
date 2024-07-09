const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { webhookController } = require('../../Controllers');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_LIST = ROLES.LIST

const fetchWebhooks = (request) => new Promise((resolve, reject) => {
    webhookController.fetchWebhooks(
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
const webhookDetail = (request) => new Promise((resolve, reject) => {
    webhookController.webhookDetail(
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
const createWebhook = (request) => new Promise((resolve, reject) => {
    webhookController.createWebhook(
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
const updateWebhook = (request) => new Promise((resolve, reject) => {
    webhookController.updateWebhook(
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

const deleteWebhook = (request) => new Promise((resolve, reject) => {
    webhookController.deleteWebhook(
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
const verifyWebhook = (request) => new Promise((resolve, reject) => {
    webhookController.verifyWebhook(
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
    path: `${V2}webhooks`,
    handler: fetchWebhooks,
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
        description: 'List webhooks',
        tags: ['Webhook', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}webhook`,
    handler: webhookDetail,
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
            query: Joi.object({ webhookId: Joi.objectId().required() })
        },
        description: 'Webhook detail',
        tags: ['Webhook', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}webhook`,
    handler: createWebhook,
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
                method: Joi.string().valid("PUT", "POST").required(),
                url: Joi.string().required(),
                token: Joi.string().optional()
            })
        },
        description: 'Create new webhook',
        tags: ['Webhook', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}webhook`,
    handler: updateWebhook,
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
                webhookId: Joi.objectId().required(),
                name: Joi.string().optional(),
                method: Joi.string().valid("PUT", "POST").optional(),
                url: Joi.string().optional(),
                token: Joi.string().optional()
            })
        },
        description: 'Update details of webhook',
        tags: ['Webhook', 'api'],
    }
},
{
    method: 'DELETE',
    path: `${V2}webhook`,
    handler: deleteWebhook,
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
            query: Joi.object({ webhookId: Joi.objectId().required() })
        },
        description: 'Remove webhook',
        tags: ['Webhook', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}verifyWebhook`,
    handler: verifyWebhook,
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
            payload: Joi.object({ webhookId: Joi.objectId().required() })
        },
        description: 'verify webhook',
        tags: ['Webhook', 'api']
    }
},
];
