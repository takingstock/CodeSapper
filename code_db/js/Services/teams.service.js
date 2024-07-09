const Models = require('../Models');

// Get TeamsUser from DB
const findAll = (
  criteria, projection, options, cb,
) => Models.Teams.find(criteria, projection, options, cb);

const findOne = (
  criteria, projection, options, cb,
) => Models.Teams.findOne(criteria, projection, options, cb);

const count = (criteria, cb) => Models.Teams.countDocuments(criteria, cb);

// Insert TeamsUser in DB
const create = (objToSave, cb) => new Models.Teams(objToSave).save(cb);

const createMany = (arrayToSave, callback) => {
  Models.Teams.insertMany(arrayToSave, callback);
};

// Update TeamsUser in DB
const update = (criteria, dataToSet, options = {}, cb) => Models.Teams
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateOne = (criteria, dataToSet, options = {}, cb) => Models.Teams
  .updateOne(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Teams
  .updateMany(criteria, dataToSet, options, cb);

const deleteOne = (criteria, cb) => Models.Teams
  .deleteOne(criteria, cb);

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
  return Models.Teams.aggregate(query, cb);
};

module.exports = {
  findAll,
  findOne,
  count,
  update,
  updateOne,
  updateAll,
  create,
  createMany,
  deleteOne,
  findAllByAggregation,
};
