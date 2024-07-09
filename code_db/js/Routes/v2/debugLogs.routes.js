const { debugController } = require('../../Controllers');
const { DEBUG_LOGS } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
  fetchLogs: (request) => new Promise((resolve, reject) => {
    debugController.fetchLogs(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  fetchLogsReport: (request) => new Promise((resolve, reject) => {
    debugController.fetchLogsReport(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

};

const routes = DEBUG_LOGS.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
