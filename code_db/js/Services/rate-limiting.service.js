const Models = require('../Models');

const create = (objToSave, cb) => new Models.RateLimit(objToSave).save(cb);

const read = (criteria, projection, options, cb) => Models.RateLimit
  .find(criteria, projection, options, cb);

const getListWithPopulate = (criteria, populateObj, projection, options, cb) => Models.RateLimit
  .find(criteria, projection, options)
  .populate(populateObj.field, populateObj.selectArray)
  .exec(cb);

const update = (criteria, dataToSet, options, cb) => Models.RateLimit
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const remove = (criteria, cb) => Models.RateLimit.deleteMany(criteria, cb);

const countTotal = (criteria, cb) => Models.RateLimit.count(criteria, cb);

module.exports = {
  create,
  read,
  update,
  remove,
  countTotal,
  getListWithPopulate,
};
