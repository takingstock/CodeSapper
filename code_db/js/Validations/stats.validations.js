const Joi = require('joi');
// const moment = require('moment');
// import JoiDate from '@hapi/joi-date';

/// /st Joi = JoiBase.extend(JoiDate);

// stats query schema
const STATS_QUERY_SCHEMA = Joi.object({
  fromDate: Joi.date().iso().less(Joi.ref('toDate')).optional(),
  toDate: Joi.date().iso().optional(),
});

module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  STATS_QUERY_SCHEMA,
};
