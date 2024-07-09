/* eslint-disable eol-last */
/* eslint-disable comma-dangle */
const config = require('config');
const mongoose = require('mongoose');
const {
  CreatedBySchema,
  DeletedBySchema
} = require('./common.schema');

const { Schema, model } = mongoose;

const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.GLOBAL_MAPPING');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const valueSchema = new Schema({
  key: {
    type: String,
    required: true,
  },
  exportKey: {
    type: String,
    required: true,
  },
  dataType: {
    type: String,
    required: true,
  },
  isRequired: {
    type: Boolean,
    default: false,
    required: true,
  },
  formula: {
    type: String,
  },
  selectableValues: {
    type: [String],
    default: []
  },
  sampleHeaders: {
    type: [String],
    default: []
  },
  excludeHeaders: {
    type: [String],
    default: []
  },
  dependancy: {
    type: String,
  },
  range: {
    min: {
      type: Schema.Types.Mixed
    },
    max: {
      type: Schema.Types.Mixed
    }
  },
  dateDisplayType: {
    type: String,
  },
  slug: {
    type: String,
    required: true,
    default: null,
  },
  description: {
    type: String,
    default: '',
  },
  threshHoldConfidenceScore: {
    type: Number,
    default: 60,
  }
})
const schema = new Schema({
  isDeleted: {
    type: Boolean,
    default: false
  },
  tenantId: {
    type: ObjectId,
    ref: REF_TENANT_MODEL,
    required: true,
  },
  customerId: {
    type: String,
  },
  docCategory: {
    type: String,
    enum: ['GOVT', 'INVOICE', 'INSURANCE', 'HEALTHCARE', 'SALARY', 'TRANSACTION_STATEMENT', 'OTHER'],
    default: 'OTHER',
    required: true,
  },
  documentType: {
    type: String,
    required: true,
  },
  isUserDefined: {
    type: Boolean,
    default: false,
  },
  isTablePresent: {
    type: Boolean,
    default: false,
  },
  isDefaultDoc: {
    type: Boolean,
    default: false,
  },
  static: {
    type: Boolean,
    default: false,
  },
  docSlug: {
    type: String,
    required: true,
    default: null,
  },
  seedId: {
    type: String,
    default: null,
  },
  mapping: {
    type: [valueSchema],
    default: null,
  },
  importedFrom: {
    type: String,
    default: null,
  },
  columns: {
    type: [valueSchema],
    default: [],
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

module.exports = model(modelName, schema);
