const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const schema = new Schema({
  ip: String,
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: false,
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'Customer',
    index: true,
    required: false,
  },
  count: {
    type: Number,
    default: 0,
  },
  limitedTill: Date,
}, {
  timestamps: true,
});

schema.index({
  ip: 1,
});

module.exports = model('RateLimit', schema);
