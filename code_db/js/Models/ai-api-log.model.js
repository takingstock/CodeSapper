const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const schema = new Schema({
    payload: {
        type: Schema.Types.Mixed,
    },
    response: {
        type: Schema.Types.Mixed,
    },
    requestTime: {
        type: Date,
        required: true,
    },
    responseTime: {
        type: Date,
        default: null,
    },
    isError: {
        type: Boolean,
        default: false,
    },
    apiType: {
        type: String,
        require: true
    }
}, {
    timestamps: true,
});

// schema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = model('aiapilog', schema);
