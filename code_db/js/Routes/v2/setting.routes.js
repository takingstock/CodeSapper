const { SETTING_MODULE } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');
const { settingController } = require('../../Controllers');

const ROUTE_HANDLERS = {
    fetchSetting: (request) => new Promise((resolve, reject) => {
        settingController.fetchSettting(
            request.auth.credentials.user,
            (err, result) => {
                if (err) {
                    return reject(BoomCustomError(err));
                }
                return resolve(result);
            },
        );
    })
};

const routes = SETTING_MODULE.map((route) => ({
    method: route.method,
    path: route.route,
    handler: ROUTE_HANDLERS[route.handler],
    options: route.options,
}));

module.exports = routes;
