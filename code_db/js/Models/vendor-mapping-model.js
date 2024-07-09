const config = require('config');

const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const modelName = config.get('SCHEMA.VENDOR_MAPPING');
const MODEL_USERS = config.get('SCHEMA.USERS');
const schema = new Schema({
    supplierName: {
        type: String,
        default: ''
    },
    supplierAddress: {
        type: String,
        default: ''
    },
    supplierNameUpdated: {
        type: String,
        default: ''
    },
    supplierAddressUpdated: {
        type: String,
        default: ''
    },
    vendorId: {
        type: String,
        default: ''
    },
    vendorIdUpdated: {
        type: String,
        default: ''
    },
    documentId: {
        type: String,
        required: true,
    },
    customerId: { // external customer id
        type: String
    },
    fileOriginalName: {
        type: String
    },
    pageRange: {
        type: String
    },
    userId: {
        type: ObjectId,
        default: null,
        ref: MODEL_USERS,
    },
    addressId: {
        type: String,
        required: true
    },
    columnType: {
        type: String
    },
    columnTypeUpdated: {
        type: String
    },
    docType: {
        type: String,
        default: "Invoices Custom",
      },
}, {
    timestamps: true,
    versionKey: false,
});

module.exports = model(modelName, schema);
