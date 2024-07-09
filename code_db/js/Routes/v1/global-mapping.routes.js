const Joi = require('joi');
const { globalMappingController } = require('../../Controllers');
const { ROUTES_GLOBAL_MAPPING_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

Joi.objectId = require('joi-objectid')(Joi);

// route handlers
const ROUTE_HANDLERS = {
  // [Handler]- fetch config
  mappingFetch: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    globalMappingController.mappingFetch(
      request.auth.credentials.user,
      request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        resolve(response);
      }
    );
  }),

  // [Handler]- fetch config detail
  mappingFetchDetail: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    globalMappingController.mappingFetchDetail(
      request.auth.credentials.user,
      request.params,
      request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler] - update config
  mappingCreate: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    globalMappingController.mappingCreate(
      request.auth.credentials.user, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler] - update config
  mappingUpdate: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    globalMappingController.mappingUpdate(
      request.auth.credentials.user, request.payload, request.params,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- config delete
  mappingDelete: async (request) => new Promise((resolve, reject) => {
    request.headers.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    globalMappingController.mappingDelete(
      request.auth.credentials.user, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    );
  }),
};

const routes = ROUTES_GLOBAL_MAPPING_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));
module.exports = routes;
