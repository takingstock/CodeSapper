const { roleController } = require('../../Controllers');
const { ROUTES_ROLE_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
  // [Handler]- role list
  roleList: (request) => new Promise((resolve, reject) => roleController.rolesList(
    request.auth.credentials.user,
    (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    },
  )),

  // [Handler]- role detail
  roleDetail: (request) => new Promise((resolve, reject) => {
    roleController.rolesDetail(request.auth.credentials.user, request.params, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

};

const routes = ROUTES_ROLE_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
