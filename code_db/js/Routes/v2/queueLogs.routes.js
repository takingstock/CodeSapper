const { queueController } = require('../../Controllers');
const { QUEUE_LOGS } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
  fetchQueueLogs: (request) => new Promise((resolve, reject) => {
    queueController.fetchQueueLogs(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  queueLogReport: (request) => new Promise((resolve, reject) => {
    queueController.queueLogsReport(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

};

const routes = QUEUE_LOGS.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
