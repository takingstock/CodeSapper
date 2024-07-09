const Models = require('../Models');

const findAll = (
  criteria, projection, options, cb,
) => Models.AddressIds.find(criteria, projection, options, cb);

// fetch one
const findOne = (criteria, projection, options = {}, cb) => Models.AddressIds
  .findOne(criteria, projection, options, cb);

// fetch count
const count = (criteria, cb) => Models.AddressIds.countDocuments(criteria, cb);

// create
const create = (objToSave, cb) => new Models.AddressIds(objToSave).save(cb);

const createMany = (objToSave, cb) => Models.AddressIds.insertMany(objToSave, cb);

// Update
const update = (criteria, dataToSet, options, cb) => Models.AddressIds
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const deleteOne = (criteria, cb) => Models.AddressIds
  .deleteOne(criteria, cb);

const deleteMany = (criteria, cb) => Models.AddressIds
  .deleteMany(criteria, cb);

module.exports = {
  findOne,
  findAll,
  update,
  create,
  count,
  deleteOne,
  createMany,
  deleteMany
};
