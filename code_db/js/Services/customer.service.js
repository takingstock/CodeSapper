const Models = require('../Models');

// Get CustomersUser from DB
// const findAll = (
//   criteria, projection, options, cb,
// ) => Models.Customers.find(criteria, projection, options, cb);

const findAll = (criteria, projection = {}, options = {}, cb) => {
  const query = Models.Customers.find(criteria, projection);
  if (options) {
    const { offset = 0, limit, sort } = options;
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
) => Models.Customers.findOne(criteria, projection, options, cb);

const count = (criteria, cb) => Models.Customers.countDocuments(criteria, cb);

// Insert CustomersUser in DB
const create = (objToSave, cb) => new Models.Customers(objToSave).save(cb);

// Update CustomersUser in DB
const update = (criteria, dataToSet, options = {}, cb) => Models.Customers
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateOne = (criteria, dataToSet, options = {}, cb) => Models.Customers
  .updateOne(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Customers
  .updateMany(criteria, dataToSet, options, cb);

const deleteOne = (criteria, cb) => Models.Customers
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
  return Models.Customers.aggregate(query, cb);
};

module.exports = {
  findAll,
  findOne,
  count,
  update,
  updateOne,
  updateAll,
  create,
  deleteOne,
  findAllByAggregation,
};
