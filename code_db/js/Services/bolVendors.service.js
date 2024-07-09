const Models = require('../Models');

// fetch all
const findAll = (criteria, projection = {}, options = null, cb) => {
  const query = Models.Vendors.find(criteria, projection);
  if (options) {
    const { offset = 0, limit, sort = null } = options;
    if (sort) {
      query.sort(sort);
    }
    if (limit) {
      query.skip(offset);
      query.limit(limit);
    }
  }
  return query.lean().exec(cb);
};

// fetch one
const findOne = (criteria, projection, options = {}, cb) => Models.Vendors
  .findOne(criteria, projection, options, cb);

// fetch count
const count = (criteria, cb) => Models.Vendors.countDocuments(criteria, cb);

// create
const create = (objToSave, cb) => new Models.Vendors(objToSave).save(cb);

const createMany = (objToSave, cb) => Models.Vendors.insertMany(objToSave, cb);

// Update
const update = (criteria, dataToSet, options, cb) => Models.Vendors
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const deleteOne = (criteria, cb) => Models.Vendors
  .deleteOne(criteria, cb);

const deleteMany = (criteria, cb) => Models.Vendors
  .deleteMany(criteria, cb);

module.exports = {
  findAll,
  findOne,
  update,
  create,
  count,
  deleteOne,
  createMany,
  deleteMany
};
