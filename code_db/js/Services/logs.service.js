const Models = require('../Models');

const findAll = (criteria, projection, options, cb) => Models
  .Logs.find(criteria, projection, options, cb);

const findOne = (criteria, projection, options = {}, cb) => Models.Logs
  .findOne(criteria, projection, options, cb);

const count = (criteria, cb) => Models.Logs.count(criteria, cb);

// Insert User in DB
const create = (objToSave, cb) => new Models.Logs(objToSave).save(cb);

// Update User in DB
const update = (criteria, dataToSet, options, cb) => Models.Logs
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Logs
  .updateMany(criteria, dataToSet, options, cb);

module.exports = {
  findAll,
  findOne,
  update,
  updateAll,
  create,
  count,
};
