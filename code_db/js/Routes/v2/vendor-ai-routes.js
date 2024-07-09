const config = require('config');
const joiMain = require("joi");
const joiDate = require("@joi/date");

const Joi = joiMain.extend(joiDate);
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { vendorsAiController } = require('../../Controllers');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
const fetchVendorsAi = (request) => new Promise((resolve, reject) => {
    vendorsAiController.fetchVendorsAiIMC(
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
const fetchVendorsMappingIndexerHistory = (request) => new Promise((resolve, reject) => {
    vendorsAiController.fetchVendorsMappingIndexerHistory(
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
const addressIdGenerator = (request) => new Promise((resolve, reject) => {
    vendorsAiController.addressIdGenerator(
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
const fetchAddressId = (request) => new Promise((resolve, reject) => {
    vendorsAiController.fetchAddressId(
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
const fetchAllAddressIds = (request) => new Promise((resolve, reject) => {
    vendorsAiController.fetchAllAddressIds(
        request.auth.credentials.user,
        (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        },
    );
})
const keyMappingGenerator = (request) => new Promise((resolve, reject) => {
    vendorsAiController.keyMappingGenerator(
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
const fetchKeyMapping = (request) => new Promise((resolve, reject) => {
    vendorsAiController.fetchKeyMapping(
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
const fetchAllKeyMapping = (request) => new Promise((resolve, reject) => {
    vendorsAiController.fetchAllKeyMapping(
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
const removekeyMapping = (request) => new Promise((resolve, reject) => {
    vendorsAiController.removekeyMapping(
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
    method: 'POST',
    path: `${V2}imc/ocr/vendorAiList`,
    handler: fetchVendorsAi,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'fetch updated Vendors Ai list',
        tags: ['imc vendor', 'api'],
    },
},
{
    method: 'GET',
    path: `${V2}vendors/vendorMappingHistory`,
    handler: fetchVendorsMappingIndexerHistory,
    options: {
        validate: {
            query: Joi.object({ fromDate: Joi.date().optional(), toDate: Joi.date().optional(), mappingChanged: Joi.boolean().optional() }).concat(SEARCH_COMMON_SCHEMA),
        },
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                },
            ],
        },
        description: 'fetch updated Vendors Ai list',
        tags: ['Vendor', 'api'],
    },
},
{
    method: 'GET',
    path: `${V2}vendors/addressIdGenerator`,
    handler: addressIdGenerator,
    options: {
        validate: {
            query: Joi.object({
                addressRaw: Joi.string().required().description("String"),
                address: Joi.string().required().description("String"),
                addressID: Joi.string().required().description("String"),
                date: Joi.date().format("YYYY-MM-DD").raw().required()
                    .description("YYYY-MM-DD"),
            }),
        },
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'Address ID Generator',
        tags: ['Vendor', 'api'],
    },
},
{
    method: 'GET',
    path: `${V2}vendors/fetchAddressId`,
    handler: fetchAddressId,
    options: {
        validate: {
            query: Joi.object({
                address: Joi.string().required().description("String"),
                date: Joi.date().format("YYYY-MM-DD").raw().required()
                    .description("YYYY-MM-DD"),
            }),
        },
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'Fetch Address ID',
        tags: ['Vendor', 'api'],
    },
},
{
    method: 'GET',
    path: `${V2}vendors/fetchAllAddressIds`,
    handler: fetchAllAddressIds,
    options: {
        validate: {
        },
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'Fetch Address ID',
        tags: ['Vendor', 'api'],
    },
},
{
    method: 'PUT',
    path: `${V2}vendors/keyMappingGenerator`,
    handler: keyMappingGenerator,
    options: {
        validate: {
            payload: Joi.object({
                addressId: Joi.string().optional().description("String"),
                tenantId: Joi.string().optional().description("String"),
                companyId: Joi.string().optional().description("String"),
                docType: Joi.string().required().description("String"),
                columnGlobal: Joi.string().required().description("String"),
                localList: Joi.array().items(Joi.string()),
            }),
        },
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'key mapping Generator',
        tags: ['Vendor', 'api'],
    },
},
{
    method: 'GET',
    path: `${V2}vendors/fetchKeyMapping`,
    handler: fetchKeyMapping,
    options: {
        validate: {
            query: Joi.object({
                addressId: Joi.string().optional().description("String"),
                tenantId: Joi.string().optional().description("String"),
                companyId: Joi.string().optional().description("String"),
                docType: Joi.string().required().description("String"),
                columnGlobal: Joi.string().required().description("String"),
            }),
        },
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'Fetch key mapping',
        tags: ['Vendor', 'api'],
    },
},
{
    method: 'GET',
    path: `${V2}vendors/fetchAllKeyMapping`,
    handler: fetchAllKeyMapping,
    options: {
        validate: {
            query: Joi.object({
                addressId: Joi.string().optional().description("String"),
                tenantId: Joi.objectId().optional().description("objectId"),
                companyId: Joi.string().optional().description("String"),
                docType: Joi.string().optional().description("String"),
                columnGlobal: Joi.string().optional().description("String"),
            }),
        },
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'Fetch key mapping',
        tags: ['Vendor', 'api'],
    },
},
{
    method: 'DELETE',
    path: `${V2}vendors/removeKeyMapping`,
    handler: removekeyMapping,
    options: {
        validate: {
            payload: Joi.object({
                tenantId: Joi.objectId().optional().description("objectId"),
                recordIds: Joi.array().items(Joi.objectId()).optional()
            })
        },
        auth: {
            strategy: AUTH_STRATEGIES.SIMPLE,
        },
        description: 'fetch updated Vendors Ai list',
        tags: ['imc vendor', 'api'],
    },
},
];
