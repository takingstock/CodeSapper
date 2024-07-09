const Models = require('../Models');

const findAll = (criteria, projection = {}, options = {}, cb) => {
  const query = Models.Idp.find(criteria, projection);
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

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.Idp
    .findOne(criteria, projection, options);
  if (populateArray) {
    populateArray.forEach((item) => {
      query.populate({
        path: item.path,
        select: item.fields,
      });
    });
  }
  return query.lean().exec(cb);
};

const findAllByAggregation = (
  criteria,
  projection,
  populate = [],
  sort,
  offset,
  limit,
  cb,
) => {
  const query = [];
  query.push({
    $match: criteria,
  });
  query.push({
    $project: projection,
  });
  populate.forEach((item) => {
    query.push({
      $lookup: {
        from: item.collection,
        localField: item.localField,
        foreignField: item.foreignField,
        as: item.outputKey,
      },
    });
  });
  if (limit) {
    query.push({
      $facet: {
        dataList: [
          { $sort: sort },
          { $skip: parseInt(offset, 10) || 0 },
          { $limit: parseInt(limit, 10) },
        ],
        count: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ],
      },
    });
  } else {
    query.push({
      $facet: {
        dataList: [
          { $sort: sort },
        ],
        count: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
            },
          },
        ],
      },
    });
  }
  return Models.Idp.aggregate(query, cb);
};

const count = (criteria, cb) => Models.Idp.countDocuments(criteria, cb);

const countDocuments = (criteria, cb) => Models.Idp.countDocuments(criteria, cb);

// Insert  batch in DB
const create = (objToSave, cb) => new Models.Idp(objToSave).save(cb);

// Update  batch in DB
const update = (criteria, dataToSet, options, cb) => Models.Idp
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options = {}, cb) => Models.Idp
  .updateMany(criteria, dataToSet, options, cb);

const calculateTimeElapsed = (criteria, cb) => {
  const query = [];
  query.push({
    $match: criteria,
  });
  query.push({
    $project: { dateDiffInSec: { $subtract: ['$ocrResponseTime', '$createdAt'] } },
  });
  return Models.Idp.aggregate(query, cb);
};

const deleteMany = (criteria, cb) => Models.Idp
  .deleteMany(criteria, cb);

const aggregation = (query, cb) => Models.Idp.aggregate(query, cb);
// const aggregation = (query, cb) => Models.Idp.aggregateRaw({ pipeline: query }, cb);

module.exports = {
  findAll,
  findAllByAggregation,
  findOne,
  update,
  updateAll,
  create,
  count,
  countDocuments,
  calculateTimeElapsed,
  deleteMany,
  aggregation,
};
