const { aiController } = require('../../Controllers');
const { ROUTES_AI_API } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {
  // [Handler]- Get -data
  getData: (request) => new Promise((resolve, reject) => {
    aiController.fetchData(request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  count: (request) => new Promise((resolve, reject) => {
    aiController.countData(request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]-  create
  // create: (request) => new Promise((resolve, reject) => {
  //   aiController.create(request.payload, (err, response) => {
  //     if (err) {
  //       return reject(BoomCustomError(err));
  //     }
  //     return resolve(response);
  //   });
  // }),

  // // [Handler]-  update
  // update: (request) => new Promise((resolve, reject) => {
  //   aiController.updateData(request.payload,(err, response) => {
  //       if (err) {
  //         return reject(BoomCustomError(err));
  //       }
  //       return resolve(response);
  //     },
  //   );
  // }),

  // // [Handler]-  delete
  // delete: (request) => new Promise((resolve, reject) => {
  //   aiController.deleteData(request.auth.credentials.user, request.payload, (err, response) => {
  //     if (err) {
  //       return reject(BoomCustomError(err));
  //     }
  //     return resolve(response);
  //   });
  // })

};

const routes = ROUTES_AI_API.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
