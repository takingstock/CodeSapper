const mongoose = require('mongoose');
const config = require('config');

const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.APP_CONFIG');
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');

// doc validation schema
const docValidationsSchema = new Schema({
  minLimit: {
    type: String,
    default: null,
  },
  maxLimit: {
    type: String,
    default: null,
  },
  validExtensions: {
    type: [String],
    default: null,
  },
});

// doc mapping schema
const docMappingSchema = new Schema({
  defaultFields: {
    type: [{
      key: String,
      name: String,
      dataType: String,
    }],
    default: null,
  },
  ocrAliases: {
    type: [{
      key: String,
      alias: String,
    }],
    default: null,
  },
  customAliases: {
    type: [{
      key: String,
      alias: String,
    }],
    default: null,
  },
});

// rule schema
const ruleSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  conditions: {
    type: [{
      docType: {
        type: String,
        required: true,
      },
      key: {
        type: String,
        required: true,
      },
      operator: {
        type: String,
        default: '=',
      },
    }],
    required: true,
  },
});

// [doc] schema
const docSchema = {
  slug: {
    type: String,
    default: null,
  },
  template: {
    type: String,
    default: null,
  },
  validations: {
    type: docValidationsSchema,
    default: null,
  },
  mapping: {
    type: docMappingSchema,
    default: null,
  },
  apis: {
    type: Schema.Types.Mixed,
    default: null,
  },
};

const schema = new Schema({
  tenantId: {
    type: ObjectId,
    ref: REF_TENANT_MODEL,
  },
  type: {
    enums: ['enterprise', 'global', 'rule'],
    type: String,
    default: 'global',
  },
  country: {
    type: String,
    default: null,
  },
  name: {
    type: String,
    required: true,
  },
  inputType: {
    type: String,
    default: null,
  },
  outputType: {
    type: String,
    default: null,
  },
  platform: {
    type: Schema.Types.Mixed,
    default: null,
  },
  uploadTypes: {
    type: [docSchema],
    default: null,
  },
  inputSourceTypes: {
    type: [
      {
        resourceType: String,
        label: String,
      },
    ],
    default: null,
  },
  outputSourceTypes: {
    type: [
      {
        resourceType: String,
        label: String,
        slug: String,
        icon: {
          type: String,
          default: null,
        },
      },
    ],
    default: null,
  },
  config: {
    type: Schema.Types.Mixed,
    default: { outputApi: { setting: null } },
  },
  userConfig: {
    type: Schema.Types.Mixed,
    default: null,
  },
  rules: {
    type: [ruleSchema],
    default: null,
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
  versionKey: false,
});

module.exports = model(modelName, schema);
