const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_TENANT_MODEL = config.get('SCHEMA.TENANTS');
const DB_CONFIG_MODEL = config.get('SCHEMA.DB_CONFIG');
const { CreatedBySchema } = require('./common.schema');

const schema = new Schema({
    name: {
        type: String,
        required: true
    },
    dbName: {
        type: String,
    },
    tableName: {
        type: String,
    },
    url: {
        type: String,
        required: true,
    },
    username: {
        type: String,
    },
    password: {
        type: String,
    },
    dbType: {
        type: String,
        enum: ['mysql', 'postgres', 'sqlite', 'mariadb', 'mssql', 'db2', 'snowflake', 'oracle'],
        default: 'mssql'
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
    port: {
        type: Number
    },
    ...CreatedBySchema.obj,
}, {
    timestamps: true,
});

// schema.index({ tenantId: 1, workflowId: 1, name: 1 }) // TODO required for trial only
module.exports = model(DB_CONFIG_MODEL, schema);
