/* eslint-disable class-methods-use-this */
/* eslint-disable import/prefer-default-export */
const { eachSeries } = require('async');
const decisionTreeController = require('../Controllers/decission-tree.controller');
const CONSOLE = require('../Utils/console-log.util');

const executeInSeries = (batches, hcb) => {
  console.log("START PROSESSING", batches.length);
  eachSeries(batches, (batch, mcb) => {
    decisionTreeController.startDecisionTree(batch._id, batch.workflowId)
      .then(() => {
        mcb(null, true);
      })
      .catch((err) => {
        console.log("END PROSESSING ERROR", err, 'skipping this batch', batch);
        mcb();
      });
  },
    (err) => {
      if (err) {
        CONSOLE.error('SOmthing went wrong during batch processing', err);
        return hcb(err);
      }
      CONSOLE.success('All Batches in the Queue have been processed');
      return hcb(null, "BATCHES PROCESSING DONE");
    });
};

module.exports = {
  executeInSeries,
};
