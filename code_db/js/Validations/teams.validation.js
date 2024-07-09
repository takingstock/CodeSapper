const Joi = require('joi');
// const config = require('config');
// const { password, SEARCH_COMMON_SCHEMA } = require('./common.schema');

Joi.objectId = require('joi-objectid')(Joi);

// ----TEAMS SCHEMA-----
  // create Team schema
  const TEAMS_USER_SCHEMA = Joi.object({
    // indexerArray: Joi.array().optional(),
    superVisorId: Joi.array().optional(),
    teamName: Joi.string().required(),
    customersArray: Joi.array(),
    reviewPercent: Joi.number().optional()
});
  // get Team Details schema
  const GET_TEAMS_DETAILS = Joi.object({
    _id: Joi.objectId().optional(),
    teamName: Joi.string().optional(),
    pageNo: Joi.number().default(1).min(1).optional(),
    limit: Joi.number().default(10).optional()
});

// Add/ Delete Users from Team
// const UPDATE_TEAM_INDEXER_SCHEMA = Joi.object({
//     // _id: Joi.string().required(),
//     indexerArray: Joi.array().optional(),
//     superVisorId: Joi.array().optional(),
//     customersArray: Joi.array(),
//     teamName: Joi.string().required(),
// })

const UPDATE_TEAM_USER_SCHEMA = Joi.object({
    // indexerArray: Joi.array().optional(),
    _id: Joi.string().required(),
    superVisorId: Joi.array().optional(),
    customersArray: Joi.array().optional(),
    teamName: Joi.string().optional(),
    reviewPercent: Joi.number().optional(),
})

// Delete the Entire  Team
const DELETE_TEAM_SCHEMA = Joi.object({
    teamName: Joi.string().required(),
})

// Delete   Team Members
const DELETE_ALL_TEAM_MEMBERS_SCHEMA = Joi.object({
    _id: Joi.string().required(),
    usersArray: Joi.array().optional(),
    superVisorsArray: Joi.array().optional(),
    customersArray: Joi.array(),
})
const CUSTOMERS_TEAM_SCHEMA = Joi.object({
    teamName: Joi.string().required(),
    customersArray: Joi.array().required()
})
module.exports = {
    TEAMS_USER_SCHEMA,
    GET_TEAMS_DETAILS,
    // UPDATE_TEAM_INDEXER_SCHEMA,
    DELETE_TEAM_SCHEMA,
    DELETE_ALL_TEAM_MEMBERS_SCHEMA,
    CUSTOMERS_TEAM_SCHEMA,
    UPDATE_TEAM_USER_SCHEMA
};
