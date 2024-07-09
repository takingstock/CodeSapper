const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { dashboardReportController } = require('../../Controllers');
// const { SEARCH_COMMON_SCHEMA } = require('../../Validations/common.schema');

const V2 = config.get('API.V2');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
// const ROLES_SADMIN_TENANT = [ROLES.TENANT, ROLES.SUPER_ADMIN]
const ROLES_LIST = ROLES.LIST

const getLatestVendorList = () => new Promise((resolve, reject) => {
    dashboardReportController.getLatestVendorList(
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
    path: `${V2}exportVendorList`,
    handler: getLatestVendorList,
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
        },
        description: 'List Vendors',
        tags: ['Dashboard', 'api'],
    }
},
];
