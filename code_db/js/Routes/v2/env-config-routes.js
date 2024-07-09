const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const envConfigController = require("../../Controllers/env-config.controller")
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const V2 = config.get('API.V2');

const fetchEnvConfiguration = () => new Promise((resolve, reject) => {
    envConfigController.fetchConfiguration((err, result) => {
        if (err) {
            return reject(BoomCustomError(err));
        }
        return resolve(result);
    })
})

const updateEnvConfiguration = (request) => new Promise((resolve, reject) => {
    console.log("dffffffffffffffd")
    envConfigController.updateConfiguration(request.payload, (err, result) => {
        if (err) {
            return reject(BoomCustomError(err));
        }
        return resolve(result);
    })
})

module.exports = [{
    method: 'GET',
    path: `${V2}envConfiguration`,
    handler: fetchEnvConfiguration,
    options: {
        description: 'fetchEnvConfiguration',
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: SUPER_ADMIN,
                },
            ],
        },
        tags: ['Env Configuration', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}updateEnvConfiguration`,
    handler: updateEnvConfiguration,
    options: {
        validate: {
            payload: Joi.object({
                _id: Joi.objectId().required(),
                defaultServerMapping: Joi.object({
                    aiServer: Joi.string().required(),
                    coreOCRServer: Joi.string().required(),
                    childServers: Joi.array().optional()
                })
            }),
        },
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: SUPER_ADMIN,
                },
            ],
        },
        description: 'updateEnvConfiguration',
        tags: ['Env Configuration', 'api'],
    }
},
];
