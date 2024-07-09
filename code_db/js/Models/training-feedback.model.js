const config = require('config');
const { number } = require('joi');
const mongoose = require('mongoose');

const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.TRAINING_FEEDBACK');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');

const schema = new Schema({
  tenantId: {
    type: ObjectId,
    ref: REF_TENANT_MODEL,
    required: true,
  },
  feedback: {
    type: {
      failedFiles: {
        type: number,
        default: null,
      },
      resolvedFiles: {
        type: number,
        default: null,
      },
    },
    required: true,
  },
  failedFiles: {
    type: Schema.Types.Mixed,
    default: null,
  },
  resolvedFiles: {
    type: Schema.Types.Mixed,
    default: null,
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

module.exports = model(modelName, schema);
