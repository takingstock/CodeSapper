const Models = require('../Models');

// Get ReportsListUser from DB
const findAll = (
  criteria, projection, options, cb,
) => Models.ReportsList.find(criteria, projection, options, cb);

const findOne = (
  criteria, projection, options, cb,
) => Models.ReportsList.findOne(criteria, projection, options, cb);

const count = (criteria, cb) => Models.ReportsList.countDocuments(criteria, cb);

// Insert ReportsListUser in DB
const create = (objToSave, cb) => new Models.ReportsList(objToSave).save(cb);

const createMany = (arrayToSave, callback) => {
  Models.ReportsList.insertMany(arrayToSave, callback);
};

// Update ReportsListUser in DB
const update = (criteria, dataToSet, options = {}, cb) => Models.ReportsList
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateOne = (criteria, dataToSet, options = {}, cb) => Models.ReportsList
  .updateOne(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.ReportsList
  .updateMany(criteria, dataToSet, options, cb);

const deleteOne = (criteria, cb) => Models.ReportsList
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
  return Models.ReportsList.aggregate(query, cb);
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
