const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const queueLogsSchema = new Schema({
  totalServer: {
    type: String,
  },
  busy: {
    type: String
  },
  free: {
    type: String,
  },
  mainQueue: {
    type: String
  },
  reClassficationQueue: {
    type: String
  },
  totalOcrResponses: {
    type: Number,
    default: 0
  },

  totalReclassificationResponses: {
    type: Number,
    default: 0
  },
  reClassficationInProgress: {
    type: Number,
    default: 0
  },
  reClassficationPending: {
    type: Number,
    default: 0
  },
  reClassficationCompleted: {
    type: Number,
    default: 0
  },
  cpuUtilization: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});
queueLogsSchema.index({ createdAt: -1 });
queueLogsSchema.index({ createdAt: 1 }, { expireAfterSeconds: (86400 * 30) }); // expiry 1 month
// queueLogsSchema.index({ createdAt: 1, time: 1 });
module.exports = model('QueueLogs', queueLogsSchema);
