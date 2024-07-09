const { ocrLogsController } = require('../../Controllers');
const { LOGS_MODULE } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
    ocrLogsFetch: (request) => new Promise((resolve, reject) => {
        ocrLogsController.ocrLogsFetch(
            request.auth.credentials.user,
            request.query,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    }),
    ocrLogsFetchMark: (request) => new Promise((resolve, reject) => {
        ocrLogsController.ocrLogsFetchMark(
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
}
const routes = LOGS_MODULE.map((route) => ({
    method: route.method,
    path: route.route,
    handler: ROUTE_HANDLERS[route.handler],
    options: route.options,
}));

module.exports = routes;
