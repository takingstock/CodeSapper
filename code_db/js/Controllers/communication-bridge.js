const config = require('config');
const syncAiResponseController = require('./syncAiResponse.controller');
const debugController = require('./debugLogs.controller');
const aiApiLogsController = require('./ai-api-logs.controller');
const { documentCompletion } = require("../Utils/ai-endpoints.util");
const splitFileController = require('./splitFile.controller')
const userHistoryBatch = require('./userHistoryBatch.controller')

const {
  PUBLISH_AI_STATUS_DOCUMENTS,
  PUBLISH_AI_STATUS_TRAINING,
  PUBLISH_AI_STATUS_BATCH,
  PUBLISH_BUCKET_STATUS_BATCH,
  PUBLISH_SUPER_ADMIN
} = require('./socket-publishers.controller');

const { LISTEN_EVENT } = require('../Utils/data-emitter.util');
// const { LOG_APPLICATION_ACTIVITY_ERRORS } = require('../Utils/logger.util');

const APP_EVENTS = config.get('APP_EVENTS');
const SOCKET_EVENTS = config.get('SOCKET_EVENTS');
const AI_STATUS = config.get('AI_STATUS');
const FEEDBACK_TYPES = config.get('FEEDBACK_TYPES');

module.exports = (socket) => {
  // listen OCR changes
  LISTEN_EVENT(APP_EVENTS.OCR, async (data) => {
    const {
      emitSocket = false, socketType, ocrResponse = {},
    } = data;
    const { batchId, tenantId, aiStatus } = ocrResponse;
    // update document with aggregate data
    // await syncAiResponseController.syncDocumentsByOcrCB(ocrResponse);
    console.log("emitSocket", emitSocket, socketType, aiStatus)
    if (emitSocket) {
      if (socketType === SOCKET_EVENTS.OCR_DOCUMENT) {
        PUBLISH_AI_STATUS_DOCUMENTS(socket, tenantId, ocrResponse);
        const idpDataToUpdate = {
          idpId: batchId,
          isOCrPassed: AI_STATUS.OCR_DONE === ocrResponse?.aiStatus,
          isOcrFailed: AI_STATUS.OCR_FAILED === ocrResponse?.aiStatus,
          isIdentified: ocrResponse?.isTableFlag && ocrResponse?.isNonTableFlag,
        };
        // update counter in batch data
        syncAiResponseController.syncBatchByOcrCB(
          idpDataToUpdate, (err, batchUpdateResponse) => {
            if (!err) {
              PUBLISH_AI_STATUS_BATCH(socket, tenantId, batchUpdateResponse);
            }
          }
        );
      }
      if (socketType === SOCKET_EVENTS.OCR_TRAINING_DOCUMENT) {
        PUBLISH_AI_STATUS_TRAINING(socket, tenantId, ocrResponse);
      }
    }
  });

  // listen Feedback Changes
  LISTEN_EVENT(APP_EVENTS.FEEDBACK, async (data) => {
    const {
      emitSocket = false, socketType, tenantId, bucketId,
      batchId, feedback, feedbackType,
    } = data;
    // update document with aggregate data
    console.log('58>>>', feedbackType)
    if (feedbackType === FEEDBACK_TYPES.TABULAR) {
      await syncAiResponseController.syncDocumentsByTabularFeedbackCB(
        feedback, tenantId, batchId, bucketId
      );
    }
    if (feedbackType === FEEDBACK_TYPES.NON_TABULAR) {
      await syncAiResponseController.syncDocumentsByNonTabularFeedbackCB(
        feedback, tenantId, batchId, bucketId
      );
    }
    if (emitSocket) {
      if (socketType === SOCKET_EVENTS.OCR_DOCUMENT) {
        PUBLISH_AI_STATUS_DOCUMENTS(socket, tenantId, feedback);
      }
    }
  });

  // listen bucket Changes
  LISTEN_EVENT(APP_EVENTS.BUCKET, (data) => {
    const {
      emitSocket = false, socketType, tenantId, batchId,
    } = data;
    if (emitSocket && socketType === 'BUCKET_BATCH_DOCUMENT') {
      PUBLISH_BUCKET_STATUS_BATCH(socket, tenantId, batchId, {
        DO_REFRESH: true,
      });
    }
  });

  // listen AI error changes
  LISTEN_EVENT(APP_EVENTS.AI_ERROR, (data) => {
    console.log('error in AI>>>', data)
    // const { type, err, docId } = data;
    // LOG_APPLICATION_ACTIVITY_ERRORS(
    //   null,
    //   err,
    //   `DOCUMENT_${docId}__OCR_FAILED - ${type}`,
    //   false,
    // );
  });
  // refresh batch list
  LISTEN_EVENT(APP_EVENTS.REFRESH_BATCHES, ({ tenantId, ...rest }) => {
    console.log("refresh event fired for tenand: ", tenantId)
    PUBLISH_AI_STATUS_BATCH(socket, tenantId, rest);
  })
  LISTEN_EVENT("SUPER_ADMIN_REFRESH", ({ ...rest }) => {
    console.log("refresh event for sueperadmin: ")
    PUBLISH_SUPER_ADMIN(socket, rest);
  })
  LISTEN_EVENT("SAVE_LOG", data => {
    // console.log(" event for logs: ,", data)
    debugController.saveLogsInDb(data, (err) => {
      if (err) {
        console.log("Err in LISTEN _EVENTS for Logs", err)
      }
    });
  })

  LISTEN_EVENT("SAVE_USER_ACTION", data => {
    // console.log(" event for logs: ,", data)
    userHistoryBatch.createUserAction(data, (err) => {
      if (err) {
        console.log("Err in LISTEN _EVENTS for user action", err)
      }
    });
  })
  LISTEN_EVENT("SAVE_AI_API_LOGS", (data) => {
    console.log("SAVE_AI_API_LOGS: ,", data.apiType)
    aiApiLogsController.createLog(data, (err) => {
      if (err) {
        console.log("Err in LISTEN _EVENTS for SAVE_AI_API_LOGS", err)
      }
    });
  })

  LISTEN_EVENT("CALL_DOCUMENT_COMPLETATION_API", (data) => {
    console.log("CALL_DOCUMENT_COMPLETATION_API: ,", data)
    documentCompletion(data).then(() => {
    })
  })
  LISTEN_EVENT("SPLIT_FILE", data => {
    console.log("SPLIT_FILE event for logs: ,", data)
    splitFileController.createSplitFile(data.data, (err) => {
      if (err) {
        console.log("Err in LISTEN _EVENTS for Logs", err)
      }
      console.log("DOCS generated")
    });
  })
};
