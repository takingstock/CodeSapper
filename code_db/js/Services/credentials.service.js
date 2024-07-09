const Models = require('../Models');

const findAll = (criteria, projection, options, cb) => Models.Credentail
  .find(criteria, projection, options, cb);

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.Credentail
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
  return Models.Credentail.aggregate(query, cb);
};

const create = (objToSave, cb) => new Models.Credentail(objToSave).save(cb);

const createMany = (arrayToSave, cb) => Models.Credentail.insertMany(
  arrayToSave, { lean: true }, cb,
);

const remove = (criteria, options, cb) => Models.Credentail.deleteMany(criteria, options, cb);

const update = (criteria, dataToSet, options, cb) => Models.Credentail
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Credentail
  .updateMany(criteria, dataToSet, options, cb);

module.exports = {
  findAll,
  findOne,
  update,
  create,
  updateAll,
  findAllByAggregation,
  remove,
  createMany,
};
