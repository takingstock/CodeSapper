const config = require('config');

const mongoose = require('mongoose');
const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const MODEL_TENANTS = config.get('SCHEMA.TENANTS');
const MODEL_CUSTOMER = config.get('SCHEMA.CUSTOMER');
const customerSchema = new Schema({
  teamName: {
    type: String,
    required: true
  },
  reviewPercent: {
    type: Number,
    default: 0
  },
  isDefault: {
    type: Boolean,
    default: false,
    required: true
  },
  customersArray: {
    type: Array,
    default: []
  },
  tenantId: {
    type: ObjectId,
    default: null,
    ref: MODEL_TENANTS,
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

customerSchema.index({
  teamName: 1
})
customerSchema.index({
  _id: 1,
  teamName: 1
})
customerSchema.index({
  tenantId: 1
})
customerSchema.index({
  _id: 1,
  tenantId: 1
})
customerSchema.index({
  tenantId: 1,
  teamName: 1
})
customerSchema.index({
  customersArray: 1
})
module.exports = model(MODEL_CUSTOMER, customerSchema);
