const config = require('config');
const mongoose = require('mongoose');

const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.IDP');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const REF_WORKFLOW_MODEL = config.get('SCHEMA.WORKFLOW');

const BucketClassSchema = new Schema({
  bucketId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  reviewedOn: {
    type: Date,
    default: null,
  },
  count: {
    type: Number,
    default: 0,
    required: true,
  },
  feedbackCount: {
    type: Number,
    default: 0,
  },
  buckets: [{
    docId: {
      type: ObjectId,
      required: true,
    },
    docCategory: {
      type: String,
      default: null,
    },
    isTrainingDoc: {
      type: Boolean,
      required: false,
    },
    isFeedApplied: {
      type: Boolean,
      default: false,
    },
  }],
});

// status/threshhold_Value/step
const schema = new Schema({
  /**
   * step 0: all pending
   * step 1: ocr completed
   * step 2: feedback pending and 1 done
   * step 3: feedback applied and 2 done
   */
  step: {
    type: Number,
    default: 0
  },
  externalCustomerId: {
    type: String,
    default: null,
  },
  externalBatchId: {
    type: String,
    default: null,
  },
  ocrStatus: {
    type: String,
    enum: ["PENDING", "COMPLETED"],
    default: "PENDING"
  },
  feedbackStatusNewFormat: {
    type: String,
    enum: ["NOT_REQUIRED", "PENDING", "COMPLETED"],
    default: "NOT_REQUIRED"
  },
  feedbackStatusFieldNotFound: {
    type: String,
    enum: ["NOT_REQUIRED", "PENDING", "COMPLETED"],
    default: "NOT_REQUIRED"
  },
  feedbackStatusTableNotDetected: {
    type: String,
    enum: ["NOT_REQUIRED", "PENDING", "COMPLETED"],
    default: "NOT_REQUIRED"
  },
  threshold: {
    type: Number,
    default: 0
  },
  thresholdLimit: {
    type: Number,
    default: 80
  },
  name: {
    type: String,
    required: true,
  },
  filesCount: {
    type: Number,
    default: 0,
  },
  filesUploadedCount: {
    type: Number,
    default: 0,
  },
  ocrFailedCount: {
    type: Number,
    default: 0,
  },
  ocrPassedCount: {
    type: Number,
    default: 0,
  },
  identifiedCount: {
    type: Number,
    default: 0,
  },
  nonIdentifiedCount: {
    type: Number,
    default: 0,
  },
  qcCount: {
    type: Number,
    default: 0,
  },
  qcSampleLimit: {
    type: Number,
    default: 0,
  },
  qcRejectedCount: {
    type: Number,
    default: 0,
  },
  qcCurrentDocument: {
    type: String,
    default: null,
  },
  qcStatus: {
    type: String,
    enum: ['STARTED', 'PENDING', 'STOPPED', 'COMPLETED', 'NOT_REQUIRED'],
    default: 'PENDING',
  },
  qcThresholdPercent: { // maximum from (100) and 15% of passed files
    type: Number,
    default: 100
  },
  processedPercent: {
    type: Number,
    default: 0,
  },
  timeElapsed: {
    type: Number,
    default: null,
  },
  modifiedCount: {
    type: Number,
    default: 0,
  },
  feedbackGiven: {
    type: Number,
    default: 0,
  },
  tenantId: {
    type: ObjectId,
    ref: REF_TENANT_MODEL,
    required: true,
  },
  configId: {
    type: ObjectId,
    ref: REF_WORKFLOW_MODEL,
    default: null,
  },
  workflowId: {
    type: ObjectId,
    ref: REF_WORKFLOW_MODEL,
    default: null,
  },
  extractedFiles: {
    type: Schema.Types.Mixed,
    default: null,
  },
  validFiles: {
    type: Schema.Types.Mixed,
    default: null,
  },
  classes: {
    type: [BucketClassSchema],
    default: [],
  },
  exportedFromUpload: {
    type: Boolean,
    required: true,
    default: false
  },
  api: {
    type: Boolean,
    default: false
  },
  uploadedVia: {
    type: String,
    default: "WEBSITE"
  },
  pageRange: {
    type: String,
    default: ''
  },
  totalPages: {
    type: Number,
    default: 0
  },
  ocrResponseTime: {
    type: Date,
    default: null
  },
  uploadedDocType: {
    type: String,
    default: "Invoices Custom"
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

schema.index({ tenantId: 1, uploadedVia: 1 })
schema.index({ tenantId: 1, name: 1 })

schema.index({ tenantId: 1, uploadedVia: 1, qcStatus: 1, ocrStatus: 1, filesUploadedCount: 1 })
schema.index({ tenantId: 1, externalCustomerId: 1, uploadedVia: 1, qcStatus: 1, ocrStatus: 1, filesUploadedCount: 1 })
schema.index({ workflowId: 1, isDeleted: 1, step: 1 })
module.exports = model(modelName, schema);
