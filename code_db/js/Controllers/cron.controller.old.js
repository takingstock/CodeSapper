const moment = require('moment');
const config = require('config');
const CONSOLE = require('../Utils/console-log.util');
const { _customiseDocumentsForProcessing, _processAiOnDocuments } = require('../Helpers/cron');
const WorkFlowDataHelper = require('../Helpers/workflow');

const { documentService, idpService } = require('../Services');

const AI_STATUS = config.get('AI_STATUS');
const CRON_DELAY_TIME = config.get('SERVER.CRON_DELAY_TIME');
const CRON_DOCS_TO_PROCESS_PER_BATCH = config.get('SERVER.CRON_DOCS_TO_PROCESS_PER_BATCH');

let IS_DOCUMENT_QUEUE_EMPTY = false;
// const IS_BATCH_QUEUE_EMPTY = false;

const DATA_HELPERS = {

  _documentsExtractViaAI: async () => {
    const UNPROCESS_DOCUMENTS = await documentService.findAll({
      configId: { $ne: null },
      isDeleted: false,
      aiStatus: { $in: [AI_STATUS.OCR_PENDING, AI_STATUS.FEEDBACK_PENDING] },
    }, {}, { limit: CRON_DOCS_TO_PROCESS_PER_BATCH });
    const mappedUnprocessedDocuments = await _customiseDocumentsForProcessing(UNPROCESS_DOCUMENTS);
    if (mappedUnprocessedDocuments && mappedUnprocessedDocuments.length) {
      CONSOLE.info(`No of documents processing with AI on ${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}: ${mappedUnprocessedDocuments.length} `);
      return _processAiOnDocuments(mappedUnprocessedDocuments);
    }
    return null;
  },

  _batchExtractViaAI: async () => {
    const BATCHES = await idpService.findAll({
      workflowId: { $ne: null },
      isDeleted: false,
    }, {}, { limit: CRON_DOCS_TO_PROCESS_PER_BATCH });
    const mappedBatches = BATCHES.map((item) => (
      { batchId: item._id, workflowId: item.workflowId }
    ));
    if (mappedBatches.length) {
      await WorkFlowDataHelper.executeInSeries(mappedBatches);
    }
    return true;
  },

};

const initAiProcess = async () => {
  setInterval(async () => {
    if (!IS_DOCUMENT_QUEUE_EMPTY) {
      IS_DOCUMENT_QUEUE_EMPTY = true; // h
      await DATA_HELPERS._documentsExtractViaAI();
      IS_DOCUMENT_QUEUE_EMPTY = false;
    }
  }, CRON_DELAY_TIME);

  // setInterval(async () => {
  //   if (!IS_BATCH_QUEUE_EMPTY) {
  //     IS_BATCH_QUEUE_EMPTY = true; // h
  //     await DATA_HELPERS._batchExtractViaAI();
  //     IS_BATCH_QUEUE_EMPTY = false;
  //   }
  // }, CRON_DELAY_TIME);

  // [TODO] - will be removed, used here for testing only
  // setInterval(() => {
  //   decisionTreeController.startDecisionTree();
  // }, 5000);
};

const CRON_HANDLERS = () => initAiProcess();

module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  CRON_HANDLERS,
};
