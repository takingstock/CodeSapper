const mongoose = require('mongoose');
const config = require('config');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const MODEL_TENANTS = config.get('SCHEMA.TENANTS');

const schema = new Schema({
    tenantId: {
        type: ObjectId,
        ref: MODEL_TENANTS,
        unique: true,
        index: true
    },
    storageLimit: {
        type: Number,
        default: 25000
    },
    storageUsed: {
        type: Number,
        default: 0
    },
    verifyReviewFilesPercent: { // the % of files needs to send, to supervisor for re-review, default to 20%
        type: Number,
        default: 20
    },
}, {
    timestamps: true
});

schema.index({
    tenantId: 1,
});
module.exports = model('TenantSetting', schema);
