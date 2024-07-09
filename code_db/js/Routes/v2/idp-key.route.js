const { idpKeyController } = require('../../Controllers');
const { IDP_KEY_MODULE } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

    generateIdpKey: (request) => new Promise((resolve, reject) => {
        idpKeyController.generateApiKey(
            request.auth.credentials.user,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    fetchApiKey: (request) => new Promise((resolve, reject) => {
        idpKeyController.fetchApiKey(
            request.auth.credentials.user,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    deleteKeyData: (request) => new Promise((resolve, reject) => {
        idpKeyController.deleteKeyData(
            request.auth.credentials.user,
            request.payload,
            request.params,
            request.query,
            (err, result) => {
                console.log(err, result);
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    updateKeyData: (request) => new Promise((resolve, reject) => {
        idpKeyController.updateKeyData(
            request.auth.credentials.user,
            request.payload,
            request.params,
            request.query,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
}
const routes = IDP_KEY_MODULE.map((route) => ({
    method: route.method,
    path: route.route,
    handler: ROUTE_HANDLERS[route.handler],
    options: route.options,
}));

module.exports = routes;
