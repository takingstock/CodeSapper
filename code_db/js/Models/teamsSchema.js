const config = require('config');

const mongoose = require('mongoose');
const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const MODEL_USER = config.get('SCHEMA.USERS');
const MODEL_TENANTS = config.get('SCHEMA.TENANTS');
const MODEL_TEAMS = config.get('SCHEMA.TEAMS');
const teamSchema = new Schema({
  superVisorId: {
    type: ObjectId,
    unique: true,
    required: true,
    ref: MODEL_USER,
  },
  indexerArray: {
    type: [{
      type: ObjectId,
      ref: MODEL_USER,
    }],
    default: []
  },
  tenantId: {
    type: ObjectId,
    default: null,
    ref: MODEL_TENANTS,
  },
  teamName: {
    type: String,
    required: true,
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
});

teamSchema.index({
  tenantId: 1,
  teamName: 1
})
teamSchema.index({
  tenantId: 1,
  superVisorId: 1
})
teamSchema.index({
  superVisorId: 1
})
teamSchema.index({
  indexerArray: 1
})
teamSchema.index({
  indexerArray: 1,
  tenantId: 1,
})

module.exports = model(MODEL_TEAMS, teamSchema);
