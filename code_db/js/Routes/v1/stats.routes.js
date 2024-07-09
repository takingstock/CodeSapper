const { statsController } = require('../../Controllers');
const { ROUTES_STATS_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  stats: async (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    statsController.stats(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
};

const routes = ROUTES_STATS_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
