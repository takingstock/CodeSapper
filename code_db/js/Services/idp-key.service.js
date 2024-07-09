const Models = require('../Models');

const findAll = (criteria, projection, options, cb) => Models
  .Idpkey.find(criteria, projection, options, cb);

const findOneCb = (criteria, projection, options = {}, cb) => Models.Idpkey
  .findOne(criteria, projection, options, cb);

const count = (criteria, cb) => Models.count(criteria, cb);

// Insert User in DB
const create = (objToSave, cb) => new Models.Idpkey(objToSave).save(cb);

// Update User in DB
const update = (criteria, dataToSet, options, cb) => Models.Idpkey
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Idpkey
  .updateMany(criteria, dataToSet, options, cb);

const findOne = (criteria, projection, options = {}) => Models.TenantModel
  .findOne(criteria, projection, options);
module.exports = {
  findAll,
  findOneCb,
  findOne,
  update,
  updateAll,
  create,
  count,
};
