const Joi = require('joi');
const config = require('config');
const { SEARCH_COMMON_SCHEMA } = require('./common.schema');

Joi.objectId = require('joi-objectid')(Joi);

const ERR_MESSAGES = config.get('ERR_MESSAGES');

// ai server creation payload schema
const AI_SERVER_PAYLOAD = Joi.object({
    name: Joi.string().required(),
    healthOcr: Joi.string().optional(),
    documentOcr: Joi.string().required(),
    healthFeedback: Joi.string().optional(),
    tabularFeedback: Joi.string().required(),
    nonTabularFeedback: Joi.string().required(),
    healthDocumentBucketing: Joi.string().optional(),
    documentBucketing: Joi.string().required(),
    documentSnipplet: Joi.string().required(),
    updateFlags: Joi.string().required()
});
//
const AI_SERVER_ID_SCHEMA = Joi.object({
    serverId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),
});
const ADD_AI_SERVER_TO_WORKFLOW = Joi.object({
    serverId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),
    workflowId: Joi.objectId().required().description(ERR_MESSAGES.VALID_OBJECTID),

}).concat(AI_SERVER_ID_SCHEMA);
const AI_SERVER_SEARCH_SCHEMA = Joi.object({
}).concat(SEARCH_COMMON_SCHEMA);
module.exports = {
    AI_SERVER_PAYLOAD,
    AI_SERVER_ID_SCHEMA,
    ADD_AI_SERVER_TO_WORKFLOW,
    AI_SERVER_SEARCH_SCHEMA
};
