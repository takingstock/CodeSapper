const Models = require('../Models');

// fetch all
const findAll = (criteria, projection, options = {}, cb) => Models.Tenant
  .find(criteria, projection, options, cb);

// fetch one
const findOne = (criteria, projection, options = {}, cb) => Models.Tenant
  .findOne(criteria, projection, options, cb);

// fetch count
const count = (criteria, cb) => Models.Tenant.count(criteria, cb);

// create
const create = (objToSave, cb) => new Models.Tenant(objToSave).save(cb);

// Update
const update = (criteria, dataToSet, options, cb) => Models.Tenant
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const deleteMany = (criteria, cb) => Models.Tenant
  .deleteOne(criteria, cb);

module.exports = {
  findAll,
  findOne,
  update,
  create,
  count,
  deleteMany,
};
