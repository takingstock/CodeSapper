const config = require('config');

const mongoose = require('mongoose');

const { Schema, model } = mongoose;

const schema = new Schema({
    defaultServerMapping: {
        aiServer: {
            type: String,
            default: "10.13.0.8"
        },
        coreOCRServer: { type: String, default: "10.13.0.6" },
        childServers: { type: [], default: [] }
    },
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

module.exports = model('env_config', schema);
