const { ROUTES_LOGS_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const { logController } = require('../../Controllers');

// [Handler]- application logs
const ROUTE_HANDLERS = {
  applicationLogs: () => new Promise((resolve, reject) => {
    logController.applicationLogs((err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
};

const routes = ROUTES_LOGS_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
