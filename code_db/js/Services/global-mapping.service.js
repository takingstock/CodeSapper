const Models = require('../Models');

const findAll = (criteria, projection, options, cb) => Models.GlobalMapping
  .find(criteria, projection, options, cb);

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.GlobalMapping
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
  offset = 0,
  limit = 0,
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
          { $skip: offset || 0 },
          { $limit: limit },
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
  return Models.GlobalMapping.aggregate(query, cb);
};

const create = (objToSave, cb) => new Models.GlobalMapping(objToSave).save(cb);
const createMany = (objToSave, cb) => Models.GlobalMapping.create(objToSave, cb);
const remove = (criteria, cb) => Models.GlobalMapping.deleteMany(criteria, cb);

const update = (criteria, dataToSet, options, cb) => Models.GlobalMapping
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.GlobalMapping
  .updateMany(criteria, dataToSet, options, cb);

const aggregateStats = (
  criteria,
  cb,
) => {
  const query = [];
  query.push({
    $facet: {
      docs: [
        {
          $match: { ...criteria },
        },
        {
          $match: {
            documentType: { $ne: null },
          },
        },
        {
          $group: {
            _id: '$documentType',
            data: { $sum: 1 },
          },
        },
      ],
    },
  });
  return Models.GlobalMapping.aggregate(query, cb);
};

module.exports = {
  findAll,
  findOne,
  update,
  create,
  createMany,
  updateAll,
  findAllByAggregation,
  aggregateStats,
  remove,
};
