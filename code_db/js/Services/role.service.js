const Models = require('../Models');

const findAll = (criteria, projection, options, cb) => Models
  .Role.find(criteria, projection, options, cb);

const findOne = (criteria, projection, options = {}, cb) => Models.Role
  .findOne(criteria, projection, options, cb);

const count = (criteria, cb) => Models.Role.countDocuments(criteria, cb);

// Insert User in DB
const create = (objToSave, cb) => new Models.Role(objToSave).save(cb);

// Update User in DB
const update = (criteria, dataToSet, options, cb) => Models.Role
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Role
  .updateMany(criteria, dataToSet, options, cb);

  const deleteMany = (criteria, cb) => Models.Role
  .deleteMany(criteria, cb);
module.exports = {
  findAll,
  findOne,
  update,
  updateAll,
  create,
  count,
  deleteMany
};
