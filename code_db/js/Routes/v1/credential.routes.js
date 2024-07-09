const { credentialController } = require('../../Controllers');
const { ROUTES_CRED_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

// route handlers
const ROUTE_HANDLERS = {
  // [Handler]- create credentails
  createCredentials: (request) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    return new Promise((resolve, reject) => credentialController.createCredentials(
      request.auth.credentials.user,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ));
  },

  // [Handler]- update credentails
  updateCredentials: (request) => new Promise(
    (resolve, reject) => credentialController.updateCredentials(
      request.auth.credentials.user,
      request.params,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler] - fetch Credentials
  fetchCredentials: (request) => new Promise(
    (resolve, reject) => credentialController.fetchCredentials(
      request.auth.credentials,
      request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler] - fetch Credentials
  deleteCredentials: (request) => new Promise(
    (resolve, reject) => credentialController.deleteCredentials(
      request.auth.credentials.user,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),
};

const routes = ROUTES_CRED_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
