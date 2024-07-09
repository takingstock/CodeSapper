const config = require('config');
const { trainingFeedbackService } = require('../Services');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
// UNUSED CONTROLLER FOR NOW MAY USED LATER
/**
 * create new feedback
 * @param {object} payload
 * @returns
 */
const createTrainingFeedback = (payload, hcb) => {
  trainingFeedbackService.create(payload, (err, response) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...response,
      ...HTTP_SUCCESS_MESSAGES.CONFIG_SUCCESS,
    });
  });
};

/**
 * fetch individual feedback
 * @returns
 */
const fetchTrainingFeedback = ({ tenantId }, hcb) => {
  trainingFeedbackService.findOne({
    tenantId,
  }, (err, response) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...response,
      ...HTTP_SUCCESS_MESSAGES.CONFIG_SUCCESS,
    });
  });
};

module.exports = {
  createTrainingFeedback,
  fetchTrainingFeedback,
};
