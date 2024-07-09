const { adminUserController } = require('../../Controllers');
const { ROUTES_ADMIN_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  // [Handler]- user list
  userList: async (request) => new Promise(
    (resolve, reject) => adminUserController
      .usersList(request.auth.credentials.user, request.query, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }),
  ),

  // [Handler]- user detail
  userDetail: async (request) => new Promise(
    (resolve, reject) => adminUserController
      .usersDetail(request.auth.credentials.user, request.params,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),

  // [Handler]- user create
  userCreate: async (request) => new Promise(
    (resolve, reject) => adminUserController
      .usersCreate(request.auth.credentials.user, request.payload,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),

  // [Handler]- user update
  userUpdate: async (request) => new Promise((resolve, reject) => adminUserController
    .usersUpdate(request.auth.credentials.user, request.params, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      })),

  // [Handler]- user delete
  userDelete: async (request) => new Promise(
    (resolve, reject) => adminUserController
      .usersDelete(request.auth.credentials.user, request.params,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),
  userWorkFlowList: (request) => new Promise(
    (resolve, reject) => adminUserController
      .userWorkFlowList(request.params, request.query, (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }),
  )
};

const routes = ROUTES_ADMIN_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
