// Batch Id
// Document Ids
// UserId
// Action
// Category
const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const REF_IDP_MODEL = config.get('SCHEMA.IDP');
const REF_DOCUMENT_MODEL = config.get('SCHEMA.DOCUMENTS');
const REF_USER_MODEL = config.get('SCHEMA.USERS')
const schema = new Schema({
    type: {
        type: String,
        required: true
    },
    idpId: {
        type: ObjectId,
        ref: REF_IDP_MODEL,
        required: true
    },
    userId: {
        type: ObjectId,
        ref: REF_USER_MODEL,
        required: true
    },
    fileOriginalName: {
        type: String
    },
    role: {
        type: String
    },
    documentId: {
        type: ObjectId,
        ref: REF_DOCUMENT_MODEL
    },
}, {
    timestamps: true,
});
schema.index({ userId: 1, idpId: 1 })
module.exports = model('dochistoryuser', schema);
