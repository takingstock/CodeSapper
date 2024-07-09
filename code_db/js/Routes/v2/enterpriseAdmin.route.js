const { enterpriseAdminController } = require('../../Controllers');
const { ENTERPRISE_ADMIN_CRUD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
  // [Handler]- user create
  createUser: (request) => new Promise((resolve, reject) => {
    enterpriseAdminController.createUser(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- Get -user
  getUser: (request) => new Promise((resolve, reject) => {
    enterpriseAdminController.getUser(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- user update
  userUpdate: (request) => new Promise((resolve, reject) => {
    enterpriseAdminController.usersUpdate(
      request.auth.credentials.user,
      request.params,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- user delete
  userDelete: (request) => new Promise((resolve, reject) => {
    enterpriseAdminController.usersDelete(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  getOwnDetails: (request) => new Promise((resolve, reject) => {
    enterpriseAdminController.getOwnDetails(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

};

const routes = ENTERPRISE_ADMIN_CRUD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
