const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const INPUT_STORAGE_MODEL = config.get('SCHEMA.INPUT_STORAGE');
const REF_WORKFLOW_MODEL = config.get('SCHEMA.WORKFLOW');

const { CreatedBySchema } = require('./common.schema');

const schema = new Schema({
    name: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ["LOCAL", "S3", "BLOB"], // , "LOCAL", "EXCEL", "CSV", "ZOHO"],
        default: "S3",
    },
    folderPath: {
        type: String,
        required: true,
    },
    accessKeyId: {
        type: String
    },
    secretAccessKey: {
        type: String
    },
    bucketName: {
        type: String
    },
    region: {
        type: String
    },
    status: {
        type: String,
        enum: ["CREATED", "VERIFIED", "NOT_VERIFIED"],
        default: "CREATED",
    },
    tenantId: {
        type: ObjectId,
        ref: REF_TENANT_MODEL,
        required: true
    },
    workflowId: {
        type: ObjectId,
        ref: REF_WORKFLOW_MODEL,
        default: null,
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
module.exports = model(INPUT_STORAGE_MODEL, schema);
