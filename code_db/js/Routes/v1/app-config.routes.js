const { configController } = require('../../Controllers');
const { ROUTES_CONFIG_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

// route handlers
const ROUTE_HANDLERS = {
  // [Handler]- fetch config
  configFetch: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    configController.configFetch(
      request.auth.credentials.user,
      request.query,
      request.headers,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- fetch config detail
  configFetchDetail: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    configController.configFetchDetail(
      request.auth.credentials.user,
      request.params,
      request.headers, (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      },
    );
  }),

  // [Handler] - update config
  configCreateConfig: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    configController.configCreate(
      request.auth.credentials.user, request.payload, request.headers, (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      },
    );
  }),

  // [Handler] - update config
  configUpdateConfig: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    configController.configUpdate(
      request.auth.credentials.user,
      request.payload, request.params,
      request.headers,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- config delete
  configDeleteConfig: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    configController.configDelete(
      request.auth.credentials.user,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      },
    );
  }),
};

const routes = ROUTES_CONFIG_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
