const { trainingController } = require('../../Controllers');
const { ROUTES_TRAINING_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  // [Handler]- training Manual
  trainingNonTabular: (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    trainingController.trainingNonTabular(
      request.auth.credentials.user,
      request.params, request.payload, (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- tabular feedback
  trainingTabular: async (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    trainingController.trainingTabular(
      request.auth.credentials.user,
      request.params, request.payload, (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- tabular feedback
  trainingManual: async (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    trainingController.trainingManual(
      request.auth.credentials.user, request.payload, (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- tabular feedback
  trainingOcr: async (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    trainingController.trainingManual(
      request.auth.credentials.user, request.payload, (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  trainingDocKeysDelete: async (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    trainingController.trainingDocKeysDelete(
      request.auth.credentials.user,
      request.payload,
      request.params, (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),
  trainingDocDetail: async (request) => new Promise((resolve, reject) => {
    request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    trainingController.trainingDocDetail(
      request.auth.credentials.user, request.params, (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      }
    );
  })
};
const routes = ROUTES_TRAINING_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
