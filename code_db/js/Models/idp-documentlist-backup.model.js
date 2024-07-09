const config = require('config');

const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_IDP_MODEL = config.get('SCHEMA.IDP');

const batchSchema = new Schema({
    idpId: {
        type: ObjectId,
        required: true,
        ref: REF_IDP_MODEL,
    },
    batch: { type: Schema.Types.Mixed },
    purgeLinks: {
        type: [String],
        default: []
    },
    purged: {
        type: Boolean,
        default: false
    },
    documents: {
        type: [Schema.Types.Mixed],
    }
}, {
    timestamps: true
})

batchSchema.index({ idpId: 1 })
batchSchema.index({ "documents.tenantId": 1, "documents.createdAt": 1 })
batchSchema.index({ createdAt: 1 }, { expireAfterSeconds: (86400 * 30) }); // expiry 1 month
module.exports = model('batch_backup', batchSchema);
