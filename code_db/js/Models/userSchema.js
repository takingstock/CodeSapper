const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userModel = new Schema({
    email: {
        type: String
    },
    password: {
        type: String,
        required: true
    },
    userFullName: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        enum: ['SUPER_ADMIN', 'ENTERPRISE_ADMIN'],
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Users', userModel);
