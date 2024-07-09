const { healthController } = require('../../Controllers');
const { ROUTES_HEALTH_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
  health: (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    healthController.health((err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
};

const routes = ROUTES_HEALTH_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
