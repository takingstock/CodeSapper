const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;

const MODEL_DOCUMENTS = config.get('SCHEMA.DOCUMENTS');
/**
 * Captcha Schema
 */
const schema = new Schema({
    documentId: {
        type: ObjectId,
        default: null,
        ref: MODEL_DOCUMENTS,
    },
    pageId: {
        type: ObjectId,
        default: null
    },
    document: {
        type: Schema.Types.Mixed,
        default: null,
    }
}, {
    timestamps: true
});
schema.index({ createdAt: 1 }, { expireAfterSeconds: (86400 * 30) }); // expiry 1 month
schema.index({ documentId: 1, pageId: 1 });

module.exports = model('documentautosave', schema);
