const { documentController } = require('../../Controllers');
const { ROUTES_DOC_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  // [Handler]- document list
  documentList: (request) => new Promise(
    (resolve, reject) => documentController
      .documentList(request.auth.credentials.user, request.query,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),

  // [Handler]- document list
  documentListIMC: (request) => new Promise(
    (resolve, reject) => documentController
      .documentListIMC(request.auth.credentials.user, request.query,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),

  // [Handler]- document detail
  documentDetail: (request) => new Promise(
    (resolve, reject) => documentController.documentDetail(
      request.auth.credentials.user, request.params, request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),
  // [Handler]- document qc
  documentQc: (request) => new Promise(
    (resolve, reject) => documentController
      .documentQc(request.auth.credentials.user,
        request.params,
        request.payload,
        true,
        (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        }),
  ),
  // [Handler]- document update
  documentUpdate: (request) => new Promise((resolve, reject) => {
      request.payload.ip = request.headers['x-real-ip'] || request.info.remoteAddress || null;
      documentController.documentUpdate(request.auth.credentials.user, request.params, request.payload, (err, response) => {
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        });
  }),

  // [Handler]- document update
  documentsForceUpdate: (request) => new Promise(
    (resolve, reject) => documentController.documentsForceUpdate(
      request.auth.credentials.user, request.params, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),
  // [Handler]- document delete
  dcoumentDelete: (request) => new Promise(
    (resolve, reject) => documentController.documentDelete(
      request.auth.credentials.user, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- document assign
  documentAssign: (request) => new Promise(
    (resolve, reject) => documentController.documentAssign(
      request.auth.credentials.user, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- fetch assign document
  fetchDocumentAssign: (request) => new Promise(
    (resolve, reject) => documentController.fetchDocumentAssign(
      request.auth.credentials.user, request.query,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- document detail
  createDownloadLink: (request) => new Promise(
    (resolve, reject) => documentController.createDownloadLink(
      request.auth.credentials.user,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- document snipplets
  documentSnipplets: (request) => new Promise(
    (resolve, reject) => documentController.documentSnipplets(
      request.auth.credentials.user, request.query,
      (err, response) => {
        console.log("SNIPET API RESPONSE err: ", err)
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- vendor Correction
  documentsVendorCorrection: (request) => new Promise(
    (resolve, reject) => documentController.documentsVendorCorrection(
      request.auth.credentials.user,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- document mapping download
  docRetrieveMapping: (request) => new Promise(
    (resolve, reject) => documentController.docRetrieveMapping(
      {}, request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- document create bucket
  bucketizationDocuments: (request) => new Promise(
    (resolve, reject) => documentController.bucketizationDocuments(
      request.auth.credentials.user,
      request.params,
      false,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),
  // [Handler]- document file download
  downloadDocumentFile: (request, h) => new Promise(
    (resolve, reject) => documentController.downloadDocumentFile(
      request,
      h,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- document mapping download
  startFileReview: (request) => new Promise(
    (resolve, reject) => documentController.startFileReview(
      request.auth.credentials.user,
      request.payload,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),

  // [Handler]- table completion
  tableCompletion: (request) => new Promise(
    (resolve, reject) => documentController.tableCompletion(
      request.auth.credentials.user, request.payload,
      (err, response) => {
        console.log("tableCompletion API RESPONSE err: ", err)
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),
  // [Handler]- table completion
  autoTableCompletion: (request) => new Promise(
    (resolve, reject) => documentController.autoTableCompletion(
      request.auth.credentials.user, request.payload,
      (err, response) => {
        console.log("auto tableCompletion API RESPONSE err: ", err)
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    ),
  ),
    // [Handler]- table completion
    fieldCompletion: (request) => new Promise(
      (resolve, reject) => documentController.fieldCompletion(
        request.auth.credentials.user, request.payload,
        (err, response) => {
          console.log("auto tableCompletion API RESPONSE err: ", err)
          if (err) {
            return reject(BoomCustomError(err));
          }
          return resolve(response);
        },
      ),
    ),
};

const routes = ROUTES_DOC_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
