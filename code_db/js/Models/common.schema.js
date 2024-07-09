const config = require('config');

const mongoose = require('mongoose');

const { Schema } = mongoose;
const { ObjectId } = Schema;
const REF_USER_MODEL = config.get('SCHEMA.USERS');

// eslint-disable-next-line import/prefer-default-export
const CreatedBySchema = new Schema({
  createdBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
  updatedBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
});

const DeletedBySchema = new Schema({
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedBy: {
    type: ObjectId,
    default: null,
    ref: REF_USER_MODEL,
  },
});

const DocumentAssignmentSchema = new Schema({
  description: {
    type: String,
    default: null,
  },
  accounts: [
    {
      type: ObjectId,
      ref: REF_USER_MODEL,
    },
  ],
});

module.exports = {
  CreatedBySchema,
  DeletedBySchema,
  DocumentAssignmentSchema,
}
