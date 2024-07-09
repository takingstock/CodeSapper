const Joi = require('joi').extend(require('@joi/date'));
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');
// get
const FETCH_QUEUE_LOGS = Joi.object({
}).concat(SEARCH_COMMON_SCHEMA)

const REPORT_GENERATION_FOR_QUEUE_LOGS = Joi.object({
  startDate: Joi.date().format("DD-MM-YYYY").raw().required()
    .description("DD-MM-YYYY"),
  endDate: Joi.date().format("DD-MM-YYYY").raw().required()
    .description("DD-MM-YYYY")
});

module.exports = {
  FETCH_QUEUE_LOGS,
  REPORT_GENERATION_FOR_QUEUE_LOGS
};
