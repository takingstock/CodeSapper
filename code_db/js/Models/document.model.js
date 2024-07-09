const config = require('config');

const mongoose = require('mongoose');
const { CreatedBySchema, DeletedBySchema, DocumentAssignmentSchema } = require('./common.schema');
const { PageSchema } = require('./document-page.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.DOCUMENTS');
const REF_IDP_MODEL = config.get('SCHEMA.IDP');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const REF_WORKFLOW_MODEL = config.get('SCHEMA.WORKFLOW');
const REF_USER_MODEL = config.get('SCHEMA.USERS')

const DB_DOC_TYPE = config.get('DB_DOC_TYPE');
const AI_STATUS = config.get('AI_STATUS');
const ExternalDocSchema = new Schema({
  batchId: { type: String, default: 0 },
  docId: { type: String, default: 0 },
  headers: [String]
})

const schema = new Schema({
  aiUniqueId: {
    type: String,
    default: null,
  },
  addressId: {
    type: String,
    default: null,
  },
  flagVendorExists: {
    type: Boolean,
    default: true,
  },
  externalId: {
    type: String,
    default: null,
  },
  external: ExternalDocSchema,
  externalCustomerId: {
    type: String,
    default: null,
  },
  idpId: {
    type: ObjectId,
    required: true,
    ref: REF_IDP_MODEL,
  },
  buckets: {
    type: [{
      bucketId: {
        type: String,
        default: null,
      },
      bucketName: {
        type: String,
        default: null,
      },
      bucketCategory: {
        type: String,
        default: null,
      },
      isTaggedAsTrainingDoc: {
        type: Boolean,
        default: false,
      },
      isFeedbackAppliedOn: {
        type: Boolean,
        default: false,
      },
    }],
    default: [],
  },
  tenantId: {
    type: ObjectId,
    ref: REF_TENANT_MODEL,
  },
  configId: {
    type: ObjectId,
    ref: REF_WORKFLOW_MODEL,
    default: null,
  },
  opType: {
    type: String,
    enum: [DB_DOC_TYPE.TRAINING, DB_DOC_TYPE.PROCESSING],
    default: DB_DOC_TYPE.PROCESSING,
  },
  uploadedDocType: {
    type: String,
    default: "Invoices Custom",
  },
  fileOriginalName: {
    type: String,
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: String,
    required: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  fileExtension: {
    type: String,
    required: true,
  },
  docType: {
    type: String,
    default: null,
  },
  aiDocType: {
    type: String,
    default: null,
  },
  confidenceScore: {
    type: Number,
    default: 0,
  },
  ocrTimeExtract: {
    type: Number,
    default: 0,
  },
  ocrRetry: {
    type: Number,
    default: 0,
  },
  mapping: {
    type: Schema.Types.Mixed,
    default: null,
  },
  mappingTable: {
    type: Schema.Types.Mixed,
    default: null,
  },
  pageArray: [PageSchema],
  aiStatus: {
    type: String,
    enum: [AI_STATUS.OCR_PENDING, AI_STATUS.OCR_INPROGRESS, AI_STATUS.OCR_DONE, AI_STATUS.OCR_FAILED, AI_STATUS.FEEDBACK_PENDING, AI_STATUS.FEEDBACK_DONE, AI_STATUS.FEEDBACK_FAILED, AI_STATUS.OCR_RETRY],
    default: AI_STATUS.OCR_PENDING,
  },
  pageRange: String,
  totalPages: Number,
  docTotalPages: Number,
  status: {
    type: String,
    enum: ['ASSIGNED', 'IN_REVIEW', 'PENDING', 'COMPLETED', 'UPLOADED', 'HOLD', 'CLASSIFICATION_CHANGING', 'CLASSIFICATION_CHANGED'],
    default: 'UPLOADED',
  },
  qcStatus: {
    type: String,
    enum: ['STARTED', 'PENDING', 'ASSIGNED_SUPERVISOR', 'STOPPED', 'COMPLETED', 'NOT_REQUIRED'],
    default: 'PENDING',
  },
  failedStage: {
    type: String,
    enum: ['', 'FILE_OCR', 'ROTATE_JPG', 'PDF_GENERATOR'],
    default: ''
  },
  classification: {
    type: String,
    enum: ['USER_STARTED', 'STARTED', 'RETRY', 'ASSIGNED_SUPERVISOR', 'COMPLETED', 'NOT_REQUIRED', 'FAILED'],
    default: 'NOT_REQUIRED',
  },
  ocrClassification: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'WITHOUT_OCR_IN_PROGRESS', 'RETRY', 'COMPLETED', 'NOT_REQUIRED', 'FAILED'],
    default: 'NOT_REQUIRED',
  },
  pdfMerged: {
    type: Boolean,
    default: false,
  },
  keyExtracted: {
    type: Boolean,
    default: false,
  },
  assignment: {
    type: DocumentAssignmentSchema,
    default: null,
  },
  isTableFlag: {
    type: Boolean,
    default: false,
  },
  isNonTableFlag: {
    type: Boolean,
    default: false,
  },
  // populate only when feedback given & can
  // be replaced again when given feedback
  bucketId: {
    type: String,
    default: null,
  },
  isFeedbackApplied: {
    type: Boolean,
    default: false,
  },
  isQcDone: {
    type: Boolean,
    default: false,
  },
  pushToRejected: {
    type: Boolean,
    default: false
  },
  workflowDocs: {
    type: Array,
    default: [],
  },
  hold: [{
    by: {
      type: ObjectId,
      ref: REF_TENANT_MODEL
    },
  }],
  reason: { type: String, default: '' },
  api: {
    type: Boolean,
    default: false
  },
  corruptFile: {
    type: Boolean,
    default: false
  },
  apiBatch: {
    type: String,
    default: "none"
  },
  ocrRequestTime: {
    type: Date,
    default: null
  },
  ocrResponseTime: {
    type: Date,
    default: null
  },
  keyExtractRequestTime: {
    type: Date,
    default: null
  },
  keyExtractResponseTime: {
    type: Date,
    default: null
  },
  uploadedVia: {
    type: String,
    default: "WEBSITE"
  },
  ocrUrl: {
    type: String,
    default: null
  },
  fileDeleted: {
    type: Boolean,
    default: false
  },
  s3Url: {
    type: String,
    default: ''
  },
  s3DocumentPdfLink: {
    type: String,
    default: ''
  },
  s3_link_final_output: {
    type: String,
    default: null
  },
  s3_ocr_path_output: {
    type: String,
    default: null
  },
  fileDownloadedAt: {
    type: Date,
    default: null
  },
  documentDeleted: {
    type: Boolean,
    default: false
  },
  documentDownloadedAt: {
    type: Date,
    default: null
  },
  docNumber: {
    type: Number,
    default: 1
  },
  reviewedBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  classifiedBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
  classifiedAt: {
    type: Date,
    default: null
  },
  reviewAcceptedBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
  revieweAcceptedAt: {
    type: Date,
    default: null
  },
  classifiedAcceptedBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
  classifiedAcceptedAt: {
    type: Date,
    default: null
  },
  isFileReviewed: { // identify whole file reviewed or not
    type: Boolean,
    default: false,
  },
  isBatchReviewed: { // identify whole Batch reviewed or not
    type: Boolean,
    default: false,
  },
  forceSubmitedBy: { // identify whole Batch reviewed or not
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
  reviewRole: {
    type: String,
    default: null
  },
  reviewStartedLockAt: {
    type: Date,
    default: null
  },
  reviewStartedLockBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
  filesMerged: {
    type: [{
      fileName: String,
      fileOriginalName: String
    }],
    default: null
  },
  table_columns: {
    type: [String],
    default: []
  },
  table_datatypes: {
    type: [String],
    default: []
  },
  table_thresholds: {
    type: [Number],
    default: []
  },
  header_table: { type: String },
  splitFileOcr: { type: Boolean, default: false },
  splitFilePageRange: { type: String, default: null },
  flag_3_5: { type: Boolean, default: false },
  feedback_column_dict: {
    type: Schema.Types.Mixed,
    default: {},
  },
  all_time_list: {
    type: Schema.Types.Mixed,
    default: []
  },
  document_metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

schema.index({ idpId: 1, aiStatus: 1 })
schema.index({ idpId: 1, fileName: 1 })
schema.index({ idpId: 1 }) // lock api // page listing classification
schema.index({ fileName: 1 })

schema.index({ tenantId: 1, aiStatus: 1, createdAt: 1 })
schema.index({ tenantId: 1, aiStatus: 1, createdAt: 1, externalCustomerId: 1 })

schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1 })
schema.index({ classification: 1, keyExtracted: 1, ocrClassification: 1 })
schema.index({ documentDownloadedAt: 1, s3DocumentPdfLink: 1, documentDeleted: 1 })
schema.index({ reviewStartedLockAt: 1 })
schema.index({ tenantId: 1, "external.batchId": 1, "external.docId": 1 })
schema.index({ aiStatus: 1, ocrRequestTime: 1 });
schema.index({ ocrClassification: 1 });
schema.index({ reviewStartedLockBy: 1, idpId: 1 });
schema.index({ ocrResponseTime: 1 });
schema.index({ keyExtractResponseTime: 1 });
schema.index({ createdAt: 1 });
/*
// Batch review indexer page listing
// schema.index({ tenanId: 1, idpId: 1, fileName: 1 }) // *dup1

//schema.index({ idpId: 1, fileName: 1, externalCustomerId: 1 }) // page listing document details

// file review indexer screen
// enterprise admin

//schema.index({ tenantId: 1, aiStatus: 1, reviewStartedLockBy: 1 }) // next batch
//schema.index({ tenantId: 1, aiStatus: 1, reviewStartedLockBy: 1, classifiedBy: 1 }) // next file
// indexer supervisor

//schema.index({ tenantId: 1, aiStatus: 1, externalCustomerId: 1, reviewStartedLockBy: 1 }) // next batch
//schema.index({ tenantId: 1, aiStatus: 1, externalCustomerId: 1, reviewStartedLockBy: 1, classifiedBy: 1 }) // next file

// supervisor screen
// tab1

//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1,reviewStartedLockBy:1 }) // ent admin // next batch
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, externalCustomerId: 1 })
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, externalCustomerId: 1,reviewStartedLockBy:1 }) // superVisor // next batch

// tab 2
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, classifiedAcceptedBy: 1 })
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, classifiedAcceptedBy: 1, reviewStartedLockBy:1 }) // ent next // next file
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, classifiedAcceptedBy: 1, externalCustomerId: 1 })
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, classifiedAcceptedBy: 1, externalCustomerId: 1, reviewStartedLockBy:1 }) // superVisor // next file

// tab 3
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, reviewAcceptedBy: 1, })
//schema.index({ tenantId: 1, isFileReviewed: 1, qcStatus: 1, classification: 1, reviewAcceptedBy: 1, externalCustomerId: 1 })
*/
module.exports = model(modelName, schema);
