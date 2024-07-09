const config = require('config');

const mongoose = require('mongoose');
// const { CreatedBySchema } = require('./common.schema');
const MODEL_TENANTS = config.get('SCHEMA.TENANTS');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const MODEL_REPORTS_LIST = config.get('SCHEMA.REPORTSLIST');
const reportsListSchema = new Schema({
  createdByUser: {
    type: String,
    required: true,
  },
  reportName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', "FAILED"],
    default: 'PENDING',
    required: true,
  },
  reportType: {
    type: String,
    enum: ['DOC_LIFECYCLE', 'EXTRACTION', "CLASSIFICATION", "MTD", "QUEUE_LOG"],
    required: true,
  },
  isDownloaded: {
    type: Boolean,
    default: false,
    required: true
  },
  tenantId: {
    type: ObjectId,
    default: null,
    ref: MODEL_TENANTS,
  },
  reportLinks: {
    type: Array,
    default: [],
    required: true,
  },
  requestData: {
    type: Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true,
});

reportsListSchema.index({
  createdByUser: 1,
  reportName: 1,
  isDownloaded: 1,
  reportLinks: 1,
  tenantId: 1
})
reportsListSchema.index({
  tenantId: 1
})
reportsListSchema.index({
  reportType: 1,
  tenantId: 1
})
reportsListSchema.index({
  createdAt: 1,
  tenantId: 1
})
reportsListSchema.index({
  updatedAt: 1,
  tenantId: 1
})

module.exports = model(MODEL_REPORTS_LIST, reportsListSchema);
