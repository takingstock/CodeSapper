const config = require('config');
const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_USER_MODEL = config.get('SCHEMA.USERS');

const schema = new Schema({
    userId: {
        type: ObjectId,
        ref: REF_USER_MODEL,
        required: true
    },
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    refreshTime: {
        type: Date,
        default: new Date()
    },
    whiteListIp: {
        type: [String]
    }
}, {
    timestamps: true,
});

module.exports = model('IDPKEY', schema);
