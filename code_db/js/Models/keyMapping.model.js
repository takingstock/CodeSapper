const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const modelName = "aikeymapping"

const schema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    default: ''
  },
  addressId: {
    type: String,
    default: '',
  },
  companyId: {
    type: String,
    default: '',
  },
  docType: {
    type: String,
    required: true,
  },
  columnGlobal: {
    type: String,
    required: true,
  },
  localList: {
    type: [String]
  }
}, {
  timestamps: true,
  versionKey: false,
});

schema.index({
  companyId: 1,
  docType: 1,
  columnGlobal: 1
});

module.exports = model(modelName, schema);
