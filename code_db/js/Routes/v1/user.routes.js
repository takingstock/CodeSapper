const { userController } = require('../../Controllers');
const { ROUTES_USER_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  // [Handler]- user profile
  userProfile: (request) => new Promise((resolve, reject) => {
    userController.userProfile(request.auth.credentials.user, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- user profile update
  updateProfile: (request) => new Promise((resolve, reject) => {
    userController.updateProfile(
      request.auth.credentials.user,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- user password update
  changePassword: (request) => new Promise((resolve, reject) => {
    userController.changePassword(
      request.auth.credentials.user,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- user list
  userList: (request) => new Promise((resolve, reject) => {
    userController.usersList(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- user detail
  userDetail: (request) => new Promise((resolve, reject) => {
    userController.usersDetail(request.auth.credentials.user, request.params, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- user create
  userCreate: (request) => new Promise((resolve, reject) => {
    userController.usersCreate(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- user update
  userUpdate: (request) => new Promise((resolve, reject) => {
    userController.usersUpdate(
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
    userController.usersDelete(request.auth.credentials.user, request.params, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- user profile update
  trialExtend: (request) => new Promise((resolve, reject) => {
    userController.trialExtend(
      request.params,
      request.payload, (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      }
    );
  }),
  // [Handler]- extend trial /storage
  requestExtension: (request) => new Promise((resolve, reject) => {
    userController.requestExtension(request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

};

const routes = ROUTES_USER_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
