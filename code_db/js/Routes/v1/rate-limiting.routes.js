const config = require('config');
const { rateLimitingController } = require('../../Controllers');

const { ROUTES_RATE_LIMIT_MOD } = require('../config.routes');

const successConfig = config.get('STATUS_MSG.SUCCESS');
const errorConfig = config.get('STATUS_MSG.ERROR');

const ROUTE_HANDLERS = {

  getList: () => new Promise((resolve) => {
    rateLimitingController.listLimitedEntries((err, result) => {
      if (err) {
        console.error('listLimitedEntries err:', err);
        resolve(errorConfig.IMP_ERROR);
      } else {
        const response = {
          ...successConfig.DEFAULT,
          data: result || null,
        };
        resolve(response);
      }
    });
  }),

  deleteEntry: (request) => new Promise((resolve) => {
    rateLimitingController.deleteEntry(request.payload, (err, result) => {
      if (err) {
        console.error('listLimitedEntries err:', err);
        resolve(errorConfig.IMP_ERROR);
      } else {
        const response = {
          ...successConfig.DEFAULT,
          data: result || null,
        };
        resolve(response);
      }
    });
  }),
};

const routes = ROUTES_RATE_LIMIT_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
