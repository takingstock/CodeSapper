const config = require('config');

const mongoose = require('mongoose');

const modelName = config.get('SCHEMA.VENDORS');

const { Schema, model } = mongoose;

const schema = new Schema({
    collectionName: {
        type: String,
        default: modelName
    },
    seedId: {
        type: Number,
        default: 10
    }
}, {
    timestamps: true,
    versionKey: false,
});

module.exports = model("current_vendor", schema);
