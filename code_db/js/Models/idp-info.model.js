const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const schema = new Schema({
    tenantId: {
        type: ObjectId,
        ref: REF_TENANT_MODEL,
        required: true,
    },
    batchName: {
        type: String,
        required: true
    },
    batchFrom: {
        type: Number,
        required: true,
    },
    batchTo: {
        type: Number,
        required: true,
    },
    feedbackGiven: {
        type: Number,
        default: 0,
    }
}, {
    timestamps: true,
});

module.exports = model("batchInfo", schema);
