const config = require('config');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');

const { _customizeNonTabularResponse, _customizeTabularResponse } = require('../Helpers/feedback');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
//  [TODO] - if required on product side
// import trainingFeedbackController from './training-feedback.controller';
const AI_ENDPOINTS = require('../Utils/ai-endpoints.util');

const CONSOLE = require('../Utils/console-log.util');

const APP_EVENTS = config.get('APP_EVENTS');
const AI_STATUS = config.get('AI_STATUS');
const SOCKET_EVENTS = config.get('SOCKET_EVENTS');
const FEEDBACK_TYPES = config.get('FEEDBACK_TYPES');

/**
 * fetch NON-TABULAR feedback
 * @param {Object} file
 * @returns
 */
const processFeedback = async (file) => {
  const { tenantId, doc_id: documentId, page_no: pageNo } = file;
  const {
    aiStatus, opType, trainingSet, bucketId = null, batchId = null, ...requestDoc
  } = file;
  let response = null;
  try {
    response = await AI_ENDPOINTS.processNonTabularTraining({
      file: requestDoc,
      trainingSet,
    });
    const { failed_files: failedFiles = [], feedback_status: feedbackStatus = {} } = response;
    const {
      resolved_files: resolvedFiles = []
    } = feedbackStatus;
    //  [TODO] - if required on product side
    // save feedback
    // await trainingFeedbackController.createTrainingFeedback({
    //   tenantId,
    //   type: 'NON_TABULAR',
    //   feedback: {
    //     failedFiles: failed,
    //     resolvedFiles: cleared,
    //   },
    //   failedFiles,
    //   resolvedFiles,
    // });
    // update document
    let feedbackResponse = _customizeNonTabularResponse(
      resolvedFiles, failedFiles,
    );
    // if resolved files & failed files are empty
    if (!feedbackResponse.length) {
      feedbackResponse = [{
        documentId,
        pageNo,
        aiStatus: AI_STATUS.FEEDBACK_FAILED,
      }];
    }
    EMIT_EVENT(APP_EVENTS.FEEDBACK, {
      emitSocket: true,
      socketType: SOCKET_EVENTS.OCR_DOCUMENT,
      feedbackType: FEEDBACK_TYPES.NON_TABULAR,
      tenantId,
      bucketId,
      batchId,
      feedback: feedbackResponse.map((item) => ({ ...item, batchId, bucketId })),
    });
    CONSOLE.success(`SUCCESS:- ${documentId} in bucket ${bucketId} have been processed by NonTabularFeedback Server`);
    return Promise.resolve(true);
  } catch (err) {
    ImcAPIEndPoints.sendEmail({
      apiTarget: 'PLATFORM',
      subject: `AI_BUGS | IDP | NON_TABULAR | ${process.env.NODE_ENV}`,
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        apiType: 'FEEDBACK_NON_TABULAR',
        tenantId,
        documentId,
        response,
        err: err.message,
      }),
    }).then(() => { }).catch(() => { });
    EMIT_EVENT(APP_EVENTS.FEEDBACK, {
      emitSocket: true,
      socketType: SOCKET_EVENTS.OCR_DOCUMENT,
      feedbackType: FEEDBACK_TYPES.NON_TABULAR,
      tenantId,
      bucketId,
      batchId,
      feedback: [{
        documentId,
        pageNo,
        aiStatus: AI_STATUS.FEEDBACK_FAILED,
      }],
    });

    EMIT_EVENT(APP_EVENTS.AI_ERROR, {
      type: AI_STATUS.FEEDBACK_NON_TABULAR_FAILED,
      err,
      docId: documentId,
    });
    CONSOLE.error(`ERROR:- ${documentId} in bucket ${bucketId} have been processed by NonTabularFeedback Server`);
    return Promise.resolve(false);
  }
};

/**
 * fetch TABULAR feedback
 * @param {Object} file
 * @returns
 */
const processTabularFeedback = async (file) => {
  const { tenantId, doc_id: documentId, page_no: pageNo } = file;
  const {
    feedbackType, aiStatus, opType, trainingSet, bucketId = null, batchId = null, ...requestDoc
  } = file;
  let response = null;
  try {
    response = await AI_ENDPOINTS.processTabularTraining({
      file: requestDoc,
      trainingSet,
    });
    const { failed_files: failedFiles = [], feedback_status: feedbackStatus = {} } = response;
    const {
      resolved_files: resolvedFiles = [],
    } = feedbackStatus;
    //  [TODO] - if required on product side
    // [TODO] save feedback
    // await trainingFeedbackController.createTrainingFeedback({
    //   tenantId,
    //   type: 'TABULAR',
    //   feedback: {
    //     failedFiles: failed,
    //     resolvedFiles: cleared,
    //   },
    //   failedFiles,
    //   resolvedFiles,
    // });
    // console.log(JSON.stringify(resolvedFiles));
    // update document
    let feedbackResponse = _customizeTabularResponse(
      resolvedFiles, failedFiles,
    );
    // if resolved files & failed files are empty
    if (!feedbackResponse.length) {
      feedbackResponse = [{
        documentId,
        pageNo,
        aiStatus: AI_STATUS.FEEDBACK_FAILED,
      }];
    }
    EMIT_EVENT(APP_EVENTS.FEEDBACK, {
      emitSocket: true,
      feedbackType: FEEDBACK_TYPES.TABULAR,
      socketType: SOCKET_EVENTS.OCR_DOCUMENT,
      tenantId,
      bucketId,
      batchId,
      feedback: feedbackResponse.map((item) => ({ ...item, batchId, bucketId })),
    });
    CONSOLE.success(`SUCCESS:- ${documentId} in bucket ${bucketId} have been processed by TabularFeedback Server`);
    return Promise.resolve(true);
  } catch (err) {
    ImcAPIEndPoints.sendEmail({
      apiTarget: 'PLATFORM',
      subject: `AI_BUGS | IDP | TABULAR | ${process.env.NODE_ENV}`,
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        apiType: 'FEEDBACK_TABULAR',
        tenantId,
        documentId,
        response,
        err: err.message,
      }),
    }).then(() => { }).catch(() => { });
    EMIT_EVENT(APP_EVENTS.FEEDBACK, {
      emitSocket: true,
      feedbackType: FEEDBACK_TYPES.TABULAR,
      socketType: SOCKET_EVENTS.OCR_DOCUMENT,
      tenantId,
      bucketId,
      batchId,
      feedback: [{
        documentId,
        pageNo,
        aiStatus: AI_STATUS.FEEDBACK_FAILED,
      }],
    });

    EMIT_EVENT(APP_EVENTS.AI_ERROR, {
      type: AI_STATUS.FEEDBACK_TABULAR_FAILED,
      err,
      docId: documentId,
    });
    CONSOLE.error(`ERROR:- ${documentId} in bucket ${bucketId} have been processed by TabularFeedback Server`);
    return Promise.resolve(false);
  }
};

module.exports = {
  processFeedback,
  processTabularFeedback,
};
