const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const schema = new Schema({
    pageId: {
        type: ObjectId,
        required: true,
    },
    cell_info_metadata: {
        type: Schema.Types.Mixed,
        default: []
    }
}, {
    timestamps: true,
})
schema.index({ createdAt: 1 }, { expireAfterSeconds: (86400 * 30) }); // expiry 1 month
schema.index({ pageId: 1 })

module.exports = model("cellinfometadatahistory", schema);
