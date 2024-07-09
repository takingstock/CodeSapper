const { mapSeries } = require('async');
const path = require('path');
const config = require('config');
const mappingController = require('./mapping.controller');
const documentController = require('./document.controller');
const AI_ENDPOINTS = require('../Utils/ai-endpoints.util');
const { appConfigService } = require('../Services');
const { _customizeOcrResponse, _customizeQr } = require('../Helpers/ocr');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');

const APP_EVENTS = config.get('APP_EVENTS');
const SOCKET_EVENTS = config.get('SOCKET_EVENTS');
const AI_STATUS = config.get('AI_STATUS');
const WORKFLOWS_DEFAULT = config.get('WORKFLOWS_DEFAULT');
const appPathDir = path.join(__dirname, '../../', 'uploads/');
const SERVER_ENV = config.get('ENV');

const _configureQrForUser = async (tenantId, configId) => {
  const workflows = await appConfigService.findAll({ tenantId }, { _id: 1, name: 1 });
  const selectedOnfig = workflows.find((item) => item._id.toString() === configId.toString());
  const { name } = selectedOnfig || {};
  const docExtractionProcess = {
    QR: false,
    OCR: true,
  };
  switch (name) {
    case WORKFLOWS_DEFAULT[0].name:
      docExtractionProcess.QR = false;
      break;
    case WORKFLOWS_DEFAULT[1].name:
      docExtractionProcess.QR = false;
      break;
    case WORKFLOWS_DEFAULT[2].name:
      docExtractionProcess.QR = true;
      break;
    case WORKFLOWS_DEFAULT[3].name:
      docExtractionProcess.QR = true;
      docExtractionProcess.OCR = false;
      break;
    default:
      break;
  }
  return docExtractionProcess;
};

/**
 * process files in series as OCR SERVER supports single file at a time
 * @param {Array} files
 * @returns
 */
const _processDocumentsInSeries = async (files) => new Promise((resolve, reject) => {
  mapSeries(files, async (file, cb) => {
    try {
      const response = await AI_ENDPOINTS.processOcr({
        path: appPathDir + file.filePath
      });
      // TODO WEBHOOK if(ai response in progress)
      cb(null, { document: file, ocr: response, aiStatus: AI_STATUS.OCR_DONE });
    } catch (err) {
      // weite logs
      EMIT_EVENT(APP_EVENTS.AI_ERROR, {
        type: AI_STATUS.OCR_FAILED,
        err,
        docId: file._id,
      });
      cb(null, {
        document: file, ocr: { type: null }, aiStatus: AI_STATUS.OCR_FAILED, type: null,
      });
    }
  }, (err, response) => {
    if (err) {
      return reject(err);
    }
    return resolve(response);
  });
});

/**
 * mapped ocr response ert enterprise config
 * @param {Object} userInfo
 * @param {String} configId
 * @param {Array} mappedsavedDocuments
 * @returns
 */
const processOcrForEnterpriseDocs = async ({ id, tenantId }, configId, mappedSavedDocuments) => {
  const ocrAiMapping = await _processDocumentsInSeries(mappedSavedDocuments);
  const finalMapping = await mappingController.mappingOcrFields(
    { id, tenantId }, configId, ocrAiMapping,
  );
  await documentController.updateDocumentsCallback(finalMapping);
  return finalMapping;
};

/**
 * mapped ocr response wrt uploaded docs
 * @param {Object} file
 * @param {String} configId
 * @returns
 */
const processDocOcr = async (file, ocrUrl = null) => {
  const {
    tenantId, pageNo = 1, idpId: batchId, opType = null, _id: documentId,
    fileOriginalName: docName = null, filePath = null, _id: docId = null,
    externalCustomerId = null
  } = file;
  const configId = file.configId || null;
  let ocrResponse = null;
  console.log("DOC_EXTRACTION", process.env.NODE_ENV, process.env.NODE_ENV, process.env.NODE_ENV, process.env.NODE_ENV !== SERVER_ENV.DEMO
    && process.env.NODE_ENV !== SERVER_ENV.TEST
    && process.env.NODE_ENV !== SERVER_ENV.PROD)
  try {
    if (process.env.NODE_ENV !== SERVER_ENV.DEMO
      && process.env.NODE_ENV !== SERVER_ENV.TEST
    ) {
      const DOC_EXTRACTION = await _configureQrForUser(file.tenantId, configId);
      // checkng if OCR required
      if (DOC_EXTRACTION.OCR) {
        ocrResponse = await AI_ENDPOINTS.processOcr({
          path: `${appPathDir}${filePath}`,
          tenantId,
          docName,
          ocrServer: ocrUrl,
          externalCustomerId,
          documentId: docId,
        });
        // TODO WEBHOOK if(ai response in progress) done
        if (ocrResponse && ocrResponse.wait) {
          return Promise.resolve(false);
        }
        if (ocrResponse.hasOwnProperty('error') && ocrResponse.error === '[AI]--OUTPUT_FAILURE'
          && ocrResponse.hasOwnProperty("errorCode") && ocrResponse.errorCode === 1) {
          ocrResponse = {
            ...ocrResponse,
            corruptFile: true
          }
        }
        ocrResponse = _customizeOcrResponse(ocrResponse);// TODO WEBHOOK if(ai response in progress)
      }
      ocrResponse = {
        ...ocrResponse,
        // create mapping from the response
        mapping: await mappingController.mappingOcrFields(
          configId,
          { ...ocrResponse },
          file,
        ),
      };

      // extracting QR info
      if (DOC_EXTRACTION.QR) {
        const { data } = await AI_ENDPOINTS.processQr(
          `${appPathDir}${file.filePath}`,
          file.tenantId,
          file._id,
        );
        data.forEach((item) => {
          const { page, QR, status } = item;
          ocrResponse = {
            ...ocrResponse,
            mapping: {
              ...ocrResponse.mapping,
              [`page_${page}_qr`]: QR || null,
              'QR status': status,
            },
          };
        });
        ocrResponse = {
          ...ocrResponse,
          pageArray: await _customizeQr(ocrResponse?.pageArray || [], data),
        };
        // updating doc pageArary with qr info
        if (!DOC_EXTRACTION.OCR && DOC_EXTRACTION.QR) {
          delete ocrResponse?.mapping['AI status'];
          ocrResponse = {
            ...ocrResponse,
            docType: 'QR',
            aiStatus: AI_STATUS.QR_PROCESSED,
          };
        }
      }
    } else {
      ocrResponse = await AI_ENDPOINTS.processOcr({
        path: `${appPathDir}${filePath}`,
        documentId: docId,
        docName,
        externalCustomerId,
        ocrServer: ocrUrl,
        tenantId,
      });
      // TODO WEBHOOK if(ai response in progress) done
      if (ocrResponse && ocrResponse.wait) {
        return Promise.resolve(false);
      }
      ocrResponse = _customizeOcrResponse(ocrResponse);

      ocrResponse = {
        ...ocrResponse,
        // create mapping from the response
        mapping: await mappingController.mappingOcrFields(
          configId,
          { ...ocrResponse },
          file,
        ),
      };
    }

    // data to send
    const aggregateData = {
      emitSocket: true,
      socketType: opType === 'PROCESSING' ? SOCKET_EVENTS.OCR_DOCUMENT : SOCKET_EVENTS.OCR_TRAINING_DOCUMENT,
      ocrResponse: {
        opType,
        tenantId,
        batchId,
        documentId,
        pageNo,
        ...ocrResponse,
      },
    };
    EMIT_EVENT(APP_EVENTS.OCR, aggregateData);
    return Promise.resolve(false);
  } catch (err) {
    ImcAPIEndPoints.sendEmail({
      apiTarget: 'PLATFORM',
      subject: `AI_BUGS | IDP | ${process.env.NODE_ENV}`,
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        apiType: 'DOCUMENT_OCR',
        tenantId,
        documentId,
        response: ocrResponse,
        err: err.message,
      }),
      filePath: `${appPathDir}${filePath}`,
    }).then(() => { }).catch(() => { });
    const mapping = await mappingController.mappingOcrFields(
      configId,
      { aiStatus: AI_STATUS.OCR_FAILED, type: null },
      file,
    );
    EMIT_EVENT(APP_EVENTS.OCR, {
      emitSocket: true,
      socketType: 'PUBLISH_AI_STATUS_DOCUMENTS',
      ocrResponse: {
        opType,
        tenantId,
        batchId,
        documentId,
        pageNo,
        aiStatus: AI_STATUS.OCR_FAILED,
        docType: null,
        mapping,
      },
    });
    EMIT_EVENT(APP_EVENTS.AI_ERROR, {
      type: AI_STATUS.OCR_FAILED,
      err: err.message || AI_STATUS.OCR_FAILED,
      docId: documentId,
    });
    return Promise.resolve(false);
  }
};

module.exports = {
  processOcrForEnterpriseDocs,
  processDocOcr,
};
