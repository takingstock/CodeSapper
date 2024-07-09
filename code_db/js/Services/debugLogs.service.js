const Models = require('../Models');

// Get DebugLogs from DB
const findAll = (
  criteria, projection, options, cb,
) => {
  const query = Models.DebugLogs.find(criteria, projection);
  if (options) {
    const { offset = 0, limit, sort = { createdAt: 1 } } = options;
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
const findOne = (
  criteria, projection, options, cb,
) => Models.DebugLogs.findOne(criteria, projection, options, cb);

// Insert DebugLogs in DB
const create = (objToSave, cb) => new Models.DebugLogs(objToSave).save(cb);

// Update DebugLogs in DB
const update = (criteria, dataToSet, options = {}, cb) => Models.DebugLogs
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.DebugLogs
  .updateMany(criteria, dataToSet, options, cb);

module.exports = {
  findAll,
  findOne,
  update,
  updateAll,
  create,
};
