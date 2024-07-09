const Models = require('../Models');

// Get QueueLogs from DB
const findAll = (criteria, projection = {}, options = {}, cb) => {
  const query = Models.QueueLogs.find(criteria, projection);
  if (options) {
    const { offset = 0, limit, sort = { createdAt: -1 } } = options;
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
) => Models.QueueLogs.findOne(criteria, projection, options, cb);

const count = (criteria, cb) => Models.QueueLogs.count(criteria, cb);
// Insert QueueLogs in DB
const create = (objToSave, cb) => new Models.QueueLogs(objToSave).save(cb);

// Update QueueLogs in DB
const update = (criteria, dataToSet, options = {}, cb) => Models.QueueLogs
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.QueueLogs
  .updateMany(criteria, dataToSet, options, cb);

module.exports = {
  findAll,
  findOne,
  update,
  updateAll,
  create,
  count
};
