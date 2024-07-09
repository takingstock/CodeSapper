const config = require('config');
const mongoose = require('mongoose');

const { CreatedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.WORKFLOW_LOGS');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const REF_WORKFLOW_MODEL = config.get('SCHEMA.WORKFLOW');

const logSchema = new Schema({
  step: {
    type: String,
  },
  status: {
    type: String,
  },
  date: {
    type: Date,
  },
});

const schema = new Schema({
  logs: {
    type: [logSchema],
    default: null,
  },
  workflowId: {
    type: ObjectId,
    required: true,
    ref: REF_WORKFLOW_MODEL,
  },
  tenantId: {
    type: ObjectId,
    required: true,
    ref: REF_TENANT_MODEL,
  },
  status: {
    type: Boolean,
    default: true,
  },
  ...CreatedBySchema.obj,
}, {
  timestamps: true,
});

module.exports = model(modelName, schema);
