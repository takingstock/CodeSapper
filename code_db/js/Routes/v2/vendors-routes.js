const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { vendorsController } = require('../../Controllers');
const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const V2 = config.get('API.V2');
const MAX_UPLOAD_LIMIT = config.get('SERVER.MAX_UPLOAD_LIMIT');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
const SUPERVISOR = [...ENTERPRISE, ROLES.SUPERVISOR]
const INDEXER = [...SUPERVISOR, ROLES.INDEXER];

const uploadNewVendors = (request) => new Promise((resolve, reject) => {
    vendorsController.uploadNewVendors(
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
const uploadNewVendorsViaImport = (request) => new Promise((resolve, reject) => {
    vendorsController.uploadNewVendorsViaImport(
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
const fetchVendors = (request) => new Promise((resolve, reject) => {
    vendorsController.fetchVendors(
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

const fetchVendorsClient = (request) => new Promise((resolve, reject) => {
    vendorsController.fetchVendors(
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
const vendorDetail = (request) => new Promise((resolve, reject) => {
    vendorsController.vendorDetail(
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
const fetchAllCustomers = (request) => new Promise((resolve, reject) => {
    console.log("REACHED HERE=====")
    vendorsController.fetchAllCustomers(request.auth.credentials.user, request.query, (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        });
})

const fetchAllCustomersLatest = (request) => new Promise((resolve, reject) => {
    console.log("REACHED HERE=====")
    vendorsController.fetchAllCustomersLatest(request.auth.credentials.user, request.query, (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        });
})
const createVendor = (request) => new Promise((resolve, reject) => {
    vendorsController.createVendor(
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
const updateVendor = (request) => new Promise((resolve, reject) => {
    vendorsController.updateVendor(
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

const deleteVendor = (request) => new Promise((resolve, reject) => {
    vendorsController.deleteVendor(
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
const uploadNewTableHeaderFile = (request) => new Promise((resolve, reject) => {
    vendorsController.uploadNewTableHeaderFile(
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
    path: `${V2}vendors`,
    handler: fetchVendors,
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
        description: 'List Vendors',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}uploadNewVendors`,
    handler: uploadNewVendors,
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
        description: 'vendor detail',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}vendors-update`,
    handler: uploadNewVendorsViaImport,
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
        description: 'Update vendors',
        tags: ['External APIs', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}vendors-update-test`,
    handler: uploadNewVendorsViaImport,
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
        description: 'Update vendors',
        tags: ['External APIs', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}vendor`,
    handler: vendorDetail,
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
        description: 'vendor detail',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}getAllCustomers`,
    handler: fetchAllCustomersLatest,
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
        description: 'Get All Customer',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'POST',
    path: `${V2}vendor`,
    handler: createVendor,
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
        description: 'Create new vendor',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}vendor`,
    handler: updateVendor,
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
        description: 'Update details of Vendor',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'DELETE',
    path: `${V2}vendor`,
    handler: deleteVendor,
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
        description: 'Remove Vendor',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}vendorList`,
    handler: fetchVendorsClient,
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
        description: 'Fetch Vendor List',
        tags: ['Vendor', 'api'],
    }
},
{
    method: 'PUT',
    path: `${V2}table-headers`,
    handler: uploadNewTableHeaderFile,
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
        description: 'Update table headers',
        tags: ['External APIs', 'api'],
    }
},
];
