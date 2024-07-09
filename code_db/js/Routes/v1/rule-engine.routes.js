const { ruleEngineController } = require('../../Controllers');
const { ROUTES_RULE_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  // [Handler]- create rule
  createRule: async (request) => new Promise(
    (resolve, reject) => ruleEngineController
      .createRule(request.auth.credentials.user, request.payload,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),
  // [Handler]- update rule
  updateRule: async (request) => new Promise(
    (resolve, reject) => ruleEngineController
      .updateRule(request.auth.credentials.user, request.payload,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),

  // [Handler]- fetch rule
  fetchRule: async (request) => new Promise(
    (resolve, reject) => ruleEngineController
      .fetchRule(request.auth.credentials.user,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),

};

const routes = ROUTES_RULE_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
