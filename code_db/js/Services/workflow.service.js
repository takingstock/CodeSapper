const Models = require('../Models');

// Get User from DB
const findAll = (criteria, projection, options, cb) => Models.Workflow
  .find(criteria, projection, options, cb);

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.Workflow
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

const count = (criteria, cb) => Models.Workflow.count(criteria, cb);

const create = (objToSave, cb) => new Models.Workflow(objToSave).save(cb);

const update = (criteria, dataToSet, options = {}, cb) => Models.Workflow
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Workflow
  .updateMany(criteria, dataToSet, options, cb);

const deleteMany = (criteria, cb) => Models.Workflow
  .deleteMany(criteria, cb);

const findAllByAggregation = (
  criteria,
  projection,
  populate = [],
  pagination = {},
  cb,
) => {
  const {
    sort,
    offset,
    limit,
  } = pagination;
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
          { $limit: parseInt(limit, 10) || 0 },
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
  return Models.Workflow.aggregate(query, cb);
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
