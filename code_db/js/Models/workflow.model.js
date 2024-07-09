const config = require('config');

const mongoose = require('mongoose');
const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.WORKFLOW');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const WEB_HOOK_MODEL = config.get('SCHEMA.WEB_HOOK');

const schema = new Schema({
  isDeleted: {
    type: Boolean,
    default: false
  },
  threshold: {
    type: Number,
    default: 80
  },
  workflow: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    default: null,
  },
  docIds: {
    type: [
      {
        docId: {
          type: ObjectId,
          ref: config.get('SCHEMA.GLOBAL_MAPPING'),
          required: true,
        },
        docType: {
          type: String,
          required: true,
        },
      },
    ],
    default: [],
  },
  primaryDocId: {
    type: ObjectId,
    default: null,
  },
  frontendJSON: {
    type: Schema.Types.Mixed,
    default: null,
  },
  backendJSON: {
    type: Schema.Types.Mixed,
    default: null,
  },
  createdVia: {
    type: String,
    enum: ['SYSTEM', 'USER'],
    default: 'USER',
  },
  variablesInFlow: {
    type: Schema.Types.Mixed,
    default: null,
  },
  outputJSON: {
    type: Schema.Types.Mixed,
    default: null,
  },
  inputJSON: {
    type: Schema.Types.Mixed,
    default: null,
  },
  validationBeingUsed: {
    type: [Schema.Types.Mixed],
    default: null,
  },
  extrenalAPIsUsed: {
    type: [Schema.Types.Mixed],
    default: null,
  },
  tenantId: {
    type: ObjectId,
    ref: REF_TENANT_MODEL,
    required: true,
  },
  published: {
    type: Boolean,
    default: false,
  },
  publishedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['Published', 'Draft', null],
    default: null,
  },
  aiServerId: {
    type: ObjectId,
    ref: 'aiserver',
    default: null
  },
  static: {
    type: Boolean,
    default: false,
  },
  webhookId: {
    type: ObjectId,
    ref: WEB_HOOK_MODEL,
    default: null
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

module.exports = model(modelName, schema);
