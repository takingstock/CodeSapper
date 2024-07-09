const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { bolVendorsController } = require('../../Controllers');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const V2 = config.get('API.V2');
const MAX_UPLOAD_LIMIT = config.get('SERVER.MAX_UPLOAD_LIMIT');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
const SUPERVISOR = [...ENTERPRISE, ROLES.SUPERVISOR]
const INDEXER = [...SUPERVISOR, ROLES.INDEXER];

const uploadNewBolVendors = (request) => new Promise((resolve, reject) => {
    bolVendorsController.uploadNewBolVendors(
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

const uploadNewBolVendorsViaImport = (request) => new Promise((resolve, reject) => {
    bolVendorsController.uploadNewBolVendorsViaImport(
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
const fetchBolVendors = (request) => new Promise((resolve, reject) => {
    bolVendorsController.fetchBolVendors(
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

const fetchBolVendorsClient = (request) => new Promise((resolve, reject) => {
    bolVendorsController.fetchBolVendors(
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
const bolVendorDetail = (request) => new Promise((resolve, reject) => {
    bolVendorsController.bolVendorDetail(
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
const fetchAllBolCustomers = (request) => new Promise((resolve, reject) => {
    console.log("REACHED HERE=====")
    bolVendorsController.fetchAllBolCustomers(request.auth.credentials.user, request.query, (err, result) => {
        if (err) {
            return reject(BoomCustomError(err));
        }
        return resolve(result);
    });
})

const createBolVendor = (request) => new Promise((resolve, reject) => {
    bolVendorsController.createBolVendor(
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
const updateBolVendor = (request) => new Promise((resolve, reject) => {
    bolVendorsController.updateBolVendor(
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

const deleteBolVendor = (request) => new Promise((resolve, reject) => {
    bolVendorsController.deleteBolVendor(
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
module.exports = [{
    method: 'GET',
    path: `${V2}bolVendors`,
    handler: fetchBolVendors,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: INDEXER,
                },
            ]
        },
        validate: {
            query: Joi.object({
                searchFilter: Joi.string().valid('overall', 'vendorId', 'customerId', 'vendorName', 'vendorAddress').optional(),
                aiFilterActive: Joi.boolean().default(false).optional(),
                externalCustomerId: Joi.string().optional()
            }).concat(SEARCH_COMMON_SCHEMA)
        },
        description: 'List bol Vendors',
        tags: ['BolVendor', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}uploadNewBolVendors`,
    handler: uploadNewBolVendors,
    options: {
        auth: {
            // strategy: AUTH_STRATEGIES.API_KEY_AUTH,
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                },
            ]
        },
        plugins: {
            'hapi-swagger': {
                payloadType: 'form'
            }
        },
        payload: {
            maxBytes: 50048576,
            parse: true,
            output: 'stream',
            timeout: 60000,
            multipart: true
        },
        validate: {
            payload: {
                file: Joi.any()
                    .meta({
                        swaggerType: 'file'
                    })
                    .required()
                    .description('XLSX File')
            }
        },
        description: 'bol vendor detail',
        tags: ['BolVendor', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}bol-vendors`,
    handler: uploadNewBolVendorsViaImport,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_KEY_AUTH,
            // strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                }
            ]
        },
        plugins: {
            'hapi-swagger': {
                payloadType: 'form'
            }
        },
        timeout: { server: 1000 * 60 * 60 },
        payload: {
            maxBytes: MAX_UPLOAD_LIMIT,
            parse: true,
            output: 'stream',
            // timeout: { server: 1000 * 60 * 60 },
            multipart: true
        },
        validate: {
            payload: {
                file: Joi.any()
                    .meta({
                        swaggerType: 'file'
                    })
                    .required()
                    .description('XLSX File')
            }
        },
        description: 'Update bol vendors',
        tags: ['External APIs', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}bolVendor`,
    handler: bolVendorDetail,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_KEY_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                },
            ]
        },
        validate: {
            query: Joi.object({
                vendorId: Joi.string().required(),
                customerId: Joi.string().required(),
            })
        },
        description: 'bol vendor detail',
        tags: ['BolVendor', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}getAllBolCustomers`,
    handler: fetchAllBolCustomers,
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
                q: Joi.string().optional(),
            })
        },
        description: 'Get All bol Customer',
        tags: ['BolVendor', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}bolVendor`,
    handler: createBolVendor,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_KEY_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                },
            ]
        },
        validate: {
            payload: Joi.object({
                vendorId: Joi.string().required(),
                customerId: Joi.string().required(),
                vendorName: Joi.string().required(),
                vendorAddress: Joi.string().required()
            })
        },
        description: 'Create new bol vendor',
        tags: ['BolVendor', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}bolVendor`,
    handler: updateBolVendor,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_KEY_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                },
            ]
        },
        validate: {
            payload: Joi.object({
                _id: Joi.objectId().required(),
                vendorId: Joi.string().optional(),
                customerId: Joi.string().optional(),
                vendorName: Joi.string().optional(),
                vendorAddress: Joi.string().optional(),
            })
        },
        description: 'Update details of bol Vendor',
        tags: ['BolVendor', 'api'],
    }
},
{
    method: 'DELETE',
    path: `${V2}bolVendor`,
    handler: deleteBolVendor,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_KEY_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                },
            ]
        },
        validate: {
            query: Joi.object({
                _id: Joi.objectId().required(),
            })
        },
        description: 'Remove bol Vendor',
        tags: ['BolVendor', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}bolVendorList`,
    handler: fetchBolVendorsClient,
    options: {
        auth: {
            strategy: AUTH_STRATEGIES.API_KEY_AUTH,
            access: [
                {
                    scope: ENTERPRISE,
                },
            ]
        },
        validate: {
            query: Joi.object({
                searchFilter: Joi.string().valid('overall', 'vendorId', 'customerId', 'vendorName', 'vendorAddress').optional(),
                aiFilterActive: Joi.boolean().default(false).optional(),
                externalCustomerId: Joi.string().optional()
            }).concat(SEARCH_COMMON_SCHEMA)
        },
        description: 'Fetch bol Vendor List',
        tags: ['BolVendor', 'api'],
    }
},
];
