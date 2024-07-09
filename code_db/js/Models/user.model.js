const config = require('config');

const mongoose = require('mongoose');
const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const modelName = config.get('SCHEMA.USERS');
// const MODEL_TEAMS = config.get('SCHEMA.TEAMS');
const MODEL_TENANTS = config.get('SCHEMA.TENANTS');
const MODEL_ROLES = config.get('SCHEMA.ROLES');

const schema = new Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  jobTitle: {
    type: String
  },
  region: {
    type: String
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  tmpPassword: {
    type: String,
    default: null,
  },
  name: {
    type: String,
    default: null,
  },
  roleId: {
    type: ObjectId,
    required: true,
    ref: MODEL_ROLES,
  },
  tenantId: {
    type: ObjectId,
    default: null,
    ref: MODEL_TENANTS,
  },
  status: {
    type: Boolean,
    default: false,
  },
  approvedOn: {
    type: Date,
    default: null,
  },
  isTrialAccount: {
    type: Boolean,
    default: false,
  },
  isTrialAccountSuspended: {
    type: Boolean,
    default: false,
  },
  trialEndDate: {
    type: Date,
    default: null,
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lastLoginDate: {
    type: Date,
    default: null,
  },
  firstLoginDate: {
    type: Date,
    default: null,
  },
  privacyConsent: {
    type: Boolean,
    default: false
  },
  isDefault: {
    type: Boolean,
    default: false,
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    required: true
  },
  useCase: {
    type: String
  },
  trialRequest: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
  },
  quotaRequest: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED']
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
  versionKey: false,
});

schema.index({
  _id: 1,
  isDeleted: 1
})
schema.index({
  tenantId: 1
})
schema.index({
  _id: 1,
  email: 1
})
schema.index({
  firstName: 1,
  tenantId: 1
})
schema.index({
  email: 1,
  tenantId: 1
})
schema.index({
  isDeleted: 1,
  tenantId: 1
})
schema.index({
  isDeleted: 1,
  tenantId: 1,
  email: 1,
})
schema.index({
  isDeleted: 1,
  tenantId: 1,
  roleId: 1,
})
schema.index({
  isDeleted: 1,
  tenantId: 1,
  roleId: 1,
  email: 1,
  _id: 1
})
schema.index({
  isDeleted: 1,
  email: 1
})

module.exports = model(modelName, schema);
