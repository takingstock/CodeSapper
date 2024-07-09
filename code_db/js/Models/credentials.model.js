const config = require('config');
const mongoose = require('mongoose');

const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.CREDENTIALS');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');

// zoho cred schema
const zohoSchema = new Schema({
  accountEmailId: {
    type: String,
    required: true,
  },
  workSpace: {
    type: String,
    required: true,
  },
  tableName: {
    type: String,
    required: true,
  },
  clientId: {
    type: String,
    required: true,
  },
  clientSecret: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
    required: true,
  },
});

const schema = new Schema({
  tenantId: {
    type: ObjectId,
    ref: REF_TENANT_MODEL,
  },
  google_drive: {
    type: Schema.Types.Mixed,
    default: null,
  },
  s3: {
    type: Schema.Types.Mixed,
    default: null,
  },
  zoho_table: {
    type: zohoSchema,
    default: null,
  },
  email: {
    type: Schema.Types.Mixed,
    default: null,
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
  versionKey: false,
});

module.exports = model(modelName, schema);
