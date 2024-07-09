const Joi = require('joi');

// password schema
const password = Joi.string().min(6).max(50).required()
  .description('Enter your password');

// search schema
const SEARCH_COMMON_SCHEMA = Joi.object({
  offset: Joi.number().positive().allow(0).optional(),
  limit: Joi.number().positive().allow(0).optional(),
  q: Joi.string().optional(),
  orderBy: Joi.string().valid('ASC', 'DESC').optional(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt').optional(),
});

module.exports = {
  SEARCH_COMMON_SCHEMA,
  password,
};
