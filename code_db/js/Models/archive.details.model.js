const config = require('config');

const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const schema = new Schema({
    lastCriteriaUsed: {
        type: Schema.Types.Mixed,
        default: null,
    },
    totalArchived: {
        type: Number,
        default: 0
    },
    collectionType: {
        type: String,
        enum: ['document', 'idp']
    },
    tenantId: {
        type: ObjectId,
        ref: REF_TENANT_MODEL
    },
}, {
    timestamps: true,
    versionKey: false,
});

module.exports = model('archivedDetail', schema);
