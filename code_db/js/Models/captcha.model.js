const mongoose = require('mongoose');

const { Schema, model } = mongoose;

/**
 * Captcha Schema
 */
const Captcha = new Schema({
    uniqueId: {
        type: String,
        required: true
    },
    randomNumber: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
Captcha.index({ 'uniqueId': 1, verified: 1 });
Captcha.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = model('Captcha', Captcha);
