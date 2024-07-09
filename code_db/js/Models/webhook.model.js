const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const WEB_HOOK_MODEL = config.get('SCHEMA.WEB_HOOK');
const { CreatedBySchema } = require('./common.schema');

const schema = new Schema({
    name: {
        type: String,
        required: true,
    },
    method: {
        type: String,
        enum: ["POST", "GET", "PUT", "UPDATE", "PATCH", "DELETE"],
        default: "PUT",
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
    token: {
        type: String,
    },
    status: {
        type: String,
        enum: ["CREATED", "VERIFIED", "UP", "DOWN"],
        default: "CREATED",
    },
    tenantId: {
        type: ObjectId,
        ref: REF_TENANT_MODEL,
        required: true
    },
    lastTestResponse: {
        type: Schema.Types.Mixed,
        default: null
    },
    ...CreatedBySchema.obj,
}, {
    timestamps: true,
});

// schema.index({ tenantId: 1, workflowId: 1, name: 1 }) // TODO required for trial only
module.exports = model(WEB_HOOK_MODEL, schema);
