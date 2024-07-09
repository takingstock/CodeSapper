const config = require('config');
const mongoose = require('mongoose');

const { CreatedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const roleConfig = config.get('ROLES');
const modelName = config.get('SCHEMA.ROLES');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');

const roleActionSchema = new Schema({
  type: String,
});

const schema = new Schema({
  role: {
    unique: true,
    type: String,
    default: roleConfig.default,
  },
  actions: {
    type: roleActionSchema,
    default: null,
  },
  tenantId: {
    type: ObjectId,
    default: false,
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
