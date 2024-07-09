const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');

const schema = new Schema({
    endpoint: {
        type: String,
        required: true,
    },
    method: {
        type: String,
        required: true,
    },
    payload: {
        type: Schema.Types.Mixed,
    },
    response: {
        type: Schema.Types.Mixed,
    },
    error: {
        type: Schema.Types.Mixed,
        default: null,
    },
    requestTime: {
        type: Number,
        required: true,
    },
    responseTime: {
        type: Number,
        default: null,
    },
    statusCode: {
        type: String,
        default: null,
    },
    ipAddress: {
        type: String,
        default: null,
    },
    tenantId: {
        type: ObjectId,
        ref: REF_TENANT_MODEL
    },
    workflowId: {
        type: String
    },
    idpId: {
        type: String
    },
    externalId: {
        type: String,
        default: null
    },
    externalCustomerId: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
});

schema.index({ tenantId: 1, idpId: 1 });
schema.index({ createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = model('APILOG', schema);
