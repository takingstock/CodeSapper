const config = require('config');

const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const modelName = config.get('SCHEMA.VENDORS');

const schema = new Schema({
  vendorId: {
    type: String
  },
  customerId: {
    type: String,
    required: true,
  },
  vendorName: {
    type: String,
  },
  vendorAddress: {
    type: String,
  },
  columnType: {
    type: String,
    default: ""
  }
}, {
  timestamps: true,
  versionKey: false,
});

schema.index({
  vendorId: 1,
});
schema.index({
  customerId: 1,
});

schema.index({
  vendorId: "text",
  customerId: "text",
  vendorName: "text",
  vendorAddress: "text",
});
// schema.index({
//   vendorId: "text",
//   vendorName: "text",
//   vendorAddress: "text",
// });
schema.index({
    createdAt: -1,
});

module.exports = model(modelName, schema);
