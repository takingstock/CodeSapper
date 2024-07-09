const config = require('config');
const mongoose = require('mongoose');

const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.TRAINING');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');

const schema = new Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['TABULAR', 'NON_TABULAR'],
    default: 'NON_TABULAR',
  },
  filesCount: {
    type: Number,
    default: 0,
  },
  tenantId: {
    type: ObjectId,
    default: false,
    ref: REF_TENANT_MODEL,
  },
  extractedFiles: {
    type: Schema.Types.Mixed,
    default: null,
  },
  validFiles: {
    type: Schema.Types.Mixed,
    default: null,
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

module.exports = model(modelName, schema);
