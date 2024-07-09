const { imcController } = require('../../Controllers');
const { ROUTES_IMC_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  updateGlobalMapping: async (request) => new Promise(
    (resolve, reject) => imcController.updateGlobalMapping(request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      }),
  ),

  updateDemoOcr: async (request) => new Promise(
    (resolve, reject) => imcController.updateDemoOcr(request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      }),
  ),

  fetchDemoOcr: async (request) => new Promise(
    (resolve, reject) => imcController.fetchDemoOcr(request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      }),
  ),

  // [Handler]- fetch config IMC
  mappingFetchIMC: async (request) => new Promise(
    (resolve, reject) => imcController.mappingFetchIMC(
      request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      },
    ),
  ),
  userDeleteIMC: (request) => new Promise(
    (resolve, reject) => imcController.userDeleteIMC(
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      },
    ),
  ),
  userUpdateIMC: (request) => new Promise(
    (resolve, reject) => imcController.userUpdateIMC(
      request.params, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError);
        }
        return resolve(response);
      },
    ),
  ),

  updateDocumentOcr: async (request) => new Promise(
    (resolve, reject) => imcController.updateDocumentOcr(request,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      }),
  ),
  updateDocumentOnRotationOcr: async (request) => new Promise(
    (resolve, reject) => imcController.updateDocumentOnRotationOcr(request,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      }),
  ),
  aiServerMapping: async (request) => new Promise(
    (resolve, reject) => imcController.aiServerMapping(request,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      }),
  ),
  fetchVendorList: async (request) => new Promise(
    (resolve, reject) => imcController.fetchVendorList(request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      })
  ),
  updateDocumentVendor: async (request) => new Promise(
    (resolve, reject) => imcController.updateDocumentVendor(request,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      }),
  ),
};

const routes = ROUTES_IMC_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
