const { teamsController } = require('../../Controllers');
const { ENTERPRISE_ADMIN_TEAMS_CRUD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
    // [Handler]- user create
    createNewTeam: (request) => new Promise((resolve, reject) => {
        teamsController.createNewTeam(request.auth.credentials.user, request.payload, (err, response) => {
        if (err) {
            return reject(BoomCustomError(err));
        }
        return resolve(response);
        });
    }),
  // [Handler]- user create
  updateMembersOfTeam: (request) => new Promise((resolve, reject) => {
    teamsController.updateMembersOfTeam(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- Get -user
  getTeamDetails: (request) => new Promise((resolve, reject) => {
    teamsController.getTeamDetails(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  getTeamWithCustomerList: (request) => new Promise((resolve, reject) => {
    teamsController.getTeamWithCustomerList(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- user delete
  deleteTeam: (request) => new Promise((resolve, reject) => {
    teamsController.deleteTeam(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
    // [Handler]- delete ALl members
  deleteAllMembersOfTeam: (request) => new Promise((resolve, reject) => {
    teamsController.deleteAllMembersOfTeam(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  addCustomersToTeam: (request) => new Promise((resolve, reject) => {
    teamsController.addCustomersToTeam(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  deleteCustomersFromTeam: (request) => new Promise((resolve, reject) => {
    teamsController.deleteCustomersFromTeam(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  })

};

const routes = ENTERPRISE_ADMIN_TEAMS_CRUD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
