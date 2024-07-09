const config = require('config');

const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const modelName = config.get('SCHEMA.ADDRESSIDS');

const schema = new Schema({
  addressRaw: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  addressID: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  }
}, {
  timestamps: true,
  versionKey: false,
});

schema.index({
  address: 1,
  date: 1,
}, { unique: true });

schema.index({
    createdAt: -1,
});

module.exports = model(modelName, schema);
