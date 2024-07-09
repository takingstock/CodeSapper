const Models = require('../Models');

const findAll = (criteria, projection = {}, options = {}) => Models.Training
  .find(criteria, projection, options);

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.Training
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
  return Models.Training.aggregate(query, cb);
};

const count = (criteria, cb) => Models.Training.countDocuments(criteria, cb);

const estimatedDocumentCount = (cb) => Models.Training.estimatedDocumentCount(cb);

// Insert  batch in DB
const create = (objToSave, cb) => new Models.Training(objToSave).save(cb);

// Update  batch in DB
const update = (criteria, dataToSet, options, cb) => Models.Training
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options = {}, cb) => Models.Training
  .updateMany(criteria, dataToSet, options, cb);

module.exports = {
  findAll,
  findAllByAggregation,
  findOne,
  update,
  updateAll,
  create,
  count,
  estimatedDocumentCount,
};
