const config = require('config');

const mongoose = require('mongoose');

const MODEL_TENANTS = config.get('SCHEMA.TENANTS');
const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const logsSchema = new Schema({
  batchId: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
  },
  from: {
    type: String,
    required: true
  },
  batchNumber: {
    type: String,
  },
  tenantId: {
    type: ObjectId,
    default: null,
    ref: MODEL_TENANTS,
  },
  payloadObject: {
    type: Object,
    required: true
  },
  createdBy: {
    type: String,
    default: null,
  },
  externalBatchId: {
    type: String,
    default: null,
  },
}, {
  timestamps: true
});
logsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });
module.exports = model('DebugLogs', logsSchema);
