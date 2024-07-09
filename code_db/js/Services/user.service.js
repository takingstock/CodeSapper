const Models = require('../Models');

// Get User from DB
const findAll = (
  criteria, projection, options, cb,
) => Models.User.find(criteria, projection, options, cb);

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.User
    .findOne(criteria, projection, options);
  if (populateArray) {
    populateArray.forEach((item) => {
      query.populate({
        path: item.path,
        select: item.fields,
      });
    });
  }
  return query.exec(cb);
};

const count = (criteria, cb) => Models.User.countDocuments(criteria, cb);

// Insert User in DB
const create = (objToSave, cb) => new Models.User(objToSave).save(cb);

// Update User in DB
const update = (criteria, dataToSet, options = {}, cb) => Models.User
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.User
  .updateMany(criteria, dataToSet, options, cb);

const deleteMany = (criteria, cb) => Models.User
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
  return Models.User.aggregate(query, cb);
};

module.exports = {
  findAll,
  findOne,
  count,
  update,
  updateAll,
  create,
  deleteMany,
  findAllByAggregation,
};
