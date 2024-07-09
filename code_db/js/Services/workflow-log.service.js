const Models = require('../Models');

// Get User from DB
const findAll = (criteria, projection, options, cb) => Models.WorkflowLog
  .find(criteria, projection, options, cb);

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.WorkflowLog
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

const count = (criteria, cb) => Models.WorkflowLog.count(criteria, cb);

const create = (objToSave, cb) => new Models.WorkflowLog(objToSave).save(cb);

const update = (criteria, dataToSet, options = {}, cb) => Models.WorkflowLog
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.WorkflowLog
  .updateMany(criteria, dataToSet, options, cb);

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
  return Models.WorkflowLog.aggregate(query, cb);
};

module.exports = {
  findAll,
  findOne,
  count,
  update,
  updateAll,
  create,
  findAllByAggregation,
};
