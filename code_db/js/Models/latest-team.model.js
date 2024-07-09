const config = require('config');

const mongoose = require('mongoose');
const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const MODEL_TENANTS = config.get('SCHEMA.TENANTS');
const MODEL_USER = config.get('SCHEMA.USERS');
const IndexerSchema = new Schema({
  reviewPercent: {
    type: Number,
    default: 100
  },
  userId: {
    type: ObjectId,
    ref: MODEL_USER,
  }
});

const SupervisorSchema = new Schema({
  userId: {
    type: ObjectId,
    ref: MODEL_USER,
  }
});

const customerSchema = new Schema({
  teamName: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    required: true
  },
  customers: {
    type: Array,
    default: []
  },
  indexers: [IndexerSchema],
  supervisors: [SupervisorSchema],
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

// customerSchema.index({
//   teamName: 1
// })
// customerSchema.index({
//   _id: 1,
//   teamName: 1
// })
// customerSchema.index({
//   tenantId: 1
// })
// customerSchema.index({
//   _id: 1,
//   tenantId: 1
// })
// customerSchema.index({
//   tenantId: 1,
//   teamName: 1
// })
// customerSchema.index({
//   customers: 1
// })
// test cases
// {
//   cust1, team1, rev: 90%, index1, sup[]
// }
// // correct
// {
//   cust2, team1, rev: 90%, index1, sup
// }
// // incorrect
// {
//   cust1, team2, rev: 80%, index1, sup
// }
module.exports = model("newteam", customerSchema);
