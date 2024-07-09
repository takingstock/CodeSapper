const PQueue = require("p-queue");
const { processOcrController, documentController } = require('../../Controllers');
const { OCR_MODULE_NEW } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const _processOcrUpload = (request) => new Promise((resolve, reject) => {
  request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
  console.log("request.query.ip", request.query.ip);
  processOcrController.processOcrUpload(
    request.auth.credentials.user,
    request.payload,
    request.params,
    request.query,
    (err, result) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(result);
    }
  );
});
// create a new queue, and pass how many you want to scrape at once

// our scraper function lives outside route to keep things clean
// the dummy function returns the title of provided url

const processOcrInbackground = (request) => new Promise((resolve, reject) => {
  request.query.ip = request.headers['x-real-ip'] || request.info.remoteAddress;
  console.log("request.query.ip", request.query.ip);
  processOcrController.processOcrInbackground(
    request.auth.credentials.user,
    request.payload,
    request.params,
    request.query,
    (err, result) => {
      if (err) {
        return reject(BoomCustomError(err));
      }
      return resolve(result);
    }
  );
});
const queue = new PQueue({ concurrency: 1 });
const queueScraper = (request) => {
  console.log("REQUEST")
  return queue.add(() => processOcrInbackground(request));
}

const ROUTE_HANDLERS = {
  processOcrUpload: _processOcrUpload,
  processOcrUploadInbackground: queueScraper,
  uploadedBatchStatus: (request) => new Promise((resolve, reject) => {
    processOcrController.uploadedBatchStatus(
      request.auth.credentials.user,
      request.query,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  listApiEndpoints: (request) => new Promise((resolve, reject) => {
    processOcrController.listApiEndpoints(
      request.auth.credentials.user,
      request.query,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    )
  }),
  workflowList: (request) => new Promise((resolve, reject) => {
    processOcrController.workflowList(
      request.auth.credentials.user,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  processDocumentDetails: (request) => new Promise((resolve, reject) => {
    processOcrController.documentDetails(
      request.auth.credentials.user,
      request.query,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  processDocumentList: (request) => new Promise((resolve, reject) => {
    processOcrController.documentList(
      request.auth.credentials.user,
      request.query,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  batchList: (request) => new Promise((resolve, reject) => {
    processOcrController.batchList(
      request.auth.credentials.user,
      request.query,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  createbatch: (request) => new Promise((resolve, reject) => {
    processOcrController.createbatch(
      request.auth.credentials.user,
      request.payload,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  verifyBatch: (request) => new Promise((resolve, reject) => {
    processOcrController.verifyBatch(
      request.auth.credentials.user,
      request.payload,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  allDocuments: (request) => new Promise((resolve, reject) => {
    processOcrController.allDocuments(
      request.auth.credentials.user,
      request.query,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    )
  }),
  idpApidownloadDocumentFile: (request, h) => new Promise(
    (resolve, reject) => documentController.downloadDocumentFile(
      request,
      h,
      (err, response) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(response);
      },
    )
  )
};

const routes = OCR_MODULE_NEW.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
