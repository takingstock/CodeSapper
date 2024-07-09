const { aiServerController } = require('../../Controllers');
const { AI_SERVER_MODULE } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
    fetchServers: (request) => new Promise((resolve, reject) => {
        aiServerController.fetchServers(
            request.query,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    serverDetails: (request) => new Promise((resolve, reject) => {
        aiServerController.serverDetails(
            request.params,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    createServer: (request) => new Promise((resolve, reject) => {
        aiServerController.createServer(
            request.payload,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    addAiServerToWorkflow: (request) => new Promise((resolve, reject) => {
        // resolve(true)
        aiServerController.addAiServerToWorkflow(
            request.payload,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    deleteServer: (request) => new Promise((resolve, reject) => {
        aiServerController.deleteServer(
            request.params,
            (err, result) => {
                console.log(err, result)
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    updateServer: (request) => new Promise((resolve, reject) => {
        aiServerController.updateServer(
            request.payload,
            request.params,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
}
const routes = AI_SERVER_MODULE.map((route) => ({
    method: route.method,
    path: route.route,
    handler: ROUTE_HANDLERS[route.handler],
    options: route.options,
}));

module.exports = routes;
