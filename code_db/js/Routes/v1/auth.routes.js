const config = require('config');
const { authController } = require('../../Controllers');
const { expireToken } = require('../../Utils/token-manager.util');
const { ROUTES_AUTH_MOD } = require('../config.routes');

const HTTP_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  loginHandler: (request) => {
    request.payload.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    return new Promise((resolve, reject) => {
      authController.loginUser(request.payload, (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve({
          ...HTTP_MESSAGES.LOGIN,
          data: result,
        });
      });
    });
  },
  registerHandler: (request) => {
    request.payload.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    return new Promise((resolve, reject) => {
      authController.registerUser(request.payload, (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      });
    });
  },
  logoutUser: (request) => new Promise((resolve, reject) => {
    expireToken(request.auth.credentials.token, (err) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(HTTP_MESSAGES.LOGOUT);
    });
  }),
  forgotPassword: (request) => new Promise((resolve, reject) => {
    authController.forgotPassword(request.payload, (err, result) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(result);
    });
  }),
  changePassword: (request) => new Promise((resolve, reject) => {
    authController.changePassword(request.payload, (err, result) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(result);
    });
  }),
  // [Handler]- user password update
  requestEmailVerification: (request) => new Promise((resolve, reject) => {
    console.log("here")
    authController.requestEmailVerification(
      request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),
};

const routes = ROUTES_AUTH_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
