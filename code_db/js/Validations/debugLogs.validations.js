const Joi = require('joi').extend(require('@joi/date'));
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

Joi.objectId = require('joi-objectid')(Joi);

// get
const GET_DEBUG_LOGS_SCHEMA = Joi.object({
  batchId: Joi.string().optional(),
  ipAddress: Joi.string().optional(),
  batchNumber: Joi.string().optional(),
  tenantId: Joi.string().optional()
}).concat(SEARCH_COMMON_SCHEMA);

const REPORT_GENERATION_FOR_DEBUG_LOGS = Joi.object({
  startDate: Joi.date().format("DD-MM-YYYY").raw().required()
    .description("DD-MM-YYYY"),
  endDate: Joi.date().format("DD-MM-YYYY").raw().required()
    .description("DD-MM-YYYY"),
  from: Joi.string().required(),
});

module.exports = {
  GET_DEBUG_LOGS_SCHEMA,
  REPORT_GENERATION_FOR_DEBUG_LOGS

};
