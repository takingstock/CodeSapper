const config = require('config');

const mongoose = require('mongoose');
const { CreatedBySchema, DeletedBySchema } = require('./common.schema');

const { Schema, model } = mongoose;

const modelName = config.get('SCHEMA.TENANTS');

const schema = new Schema({
  name: {
    type: String,
    required: true
  },
  status: {
    type: Boolean,
    default: true,
  },
  ...CreatedBySchema.obj,
  ...DeletedBySchema.obj,
}, {
  timestamps: true,
  versionKey: false,
});

module.exports = model(modelName, schema);
