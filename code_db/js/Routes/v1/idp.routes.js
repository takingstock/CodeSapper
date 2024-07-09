const { nanoid } = require('nanoid');
const config = require('config');
const { idpController } = require('../../Controllers');
const { ROUTES_IDP_MOD } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const OUTPUT_EXTENSIONS = config.get('OUTPUT_EXTENSIONS');

const ROUTE_HANDLERS = {
  // [Handler]- doc list
  processUpload: (request, h) => new Promise((resolve, reject) => {
    idpController.processUpload(
      request.auth.credentials.user,
      request.payload,
      request.params,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        const { output = OUTPUT_EXTENSIONS.JSON } = request.query || {};
        if (output === OUTPUT_EXTENSIONS.CSV) {
          return h.response(response)
            .header('Content-Type', 'text/csv')
            .header(`Content-Disposition', 'attachment; filename=${nanoid(15)}.csv`);
        }
        return resolve(response);
      },
    );
  }),

  // [Handler]- role list
  idpList: (request) => new Promise((resolve, reject) => {
    idpController.idpList(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- document detail
  idpDetail: (request) => new Promise((resolve, reject) => {
    idpController.idpDetail(request.auth.credentials.user, request.params, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- document delete
  idpDelete: (request) => new Promise((resolve, reject) => {
    idpController.idpDelete(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),

  // [Handler]- download batch mapped
  batchCreateDownloadLink: (request) => new Promise(
    (resolve, reject) => idpController.batchCreateDownloadLink(
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
  // [Handler]- download batch mapped
  idpStartAiProcess: (request) => new Promise(
    (resolve, reject) => idpController.idpStartAiProcess(
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
  qualityCheck: (request) => new Promise(
    (resolve, reject) => idpController.qualityCheck(
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
  // [Handler]- batch/idp list optimised api
  idpBatchList: (request) => new Promise((resolve, reject) => {
    idpController.idpBatchList(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- batch/idp batchDropdownList optimised api
  batchDropdownList: (request) => new Promise((resolve, reject) => {
    idpController.batchDropdownList(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- batch/idp batchDetails optimised api
  batchDetails: (request) => new Promise((resolve, reject) => {
    idpController.batchDetails(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- batch/idp files listing
  fileListing: (request) => new Promise((resolve, reject) => {
    idpController.fileListing(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- batch/idp files listing
  superVisorAssignedFileListing: (request) => new Promise((resolve, reject) => {
    idpController.superVisorAssignedFileListing(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  superVisorFiles: (request) => new Promise((resolve, reject) => {
    idpController.superVisorFiles(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  indexerAssignedFileListing: (request) => new Promise((resolve, reject) => {
    idpController.indexerAssignedFileListing(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  indexerFiles: (request) => new Promise((resolve, reject) => {
    idpController.indexerFiles(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  // [Handler]- batch/idp page listing
  pageListing: (request) => new Promise((resolve, reject) => {
    idpController.pageListing(request.auth.credentials.user, request.query, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  reClassifyDocumentsFromFile: (request) => new Promise((resolve, reject) => {
    request.payload.ip = request.headers['x-real-ip'] || request.info.remoteAddress || null;
    idpController.reClassifyDocumentsFromFile(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  hardResetBatch: (request) => new Promise((resolve, reject) => {
    idpController.hardResetBatch(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  moveFilesBetweenBatches: (request) => new Promise((resolve, reject) => {
    idpController.moveFilesBetweenBatches(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  }),
  deleteFile: (request) => new Promise((resolve, reject) => {
    idpController.deleteFile(request.auth.credentials.user, request.payload, (err, response) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(response);
    });
  })
};

const routes = ROUTES_IDP_MOD.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));
module.exports = routes;
