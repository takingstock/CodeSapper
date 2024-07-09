const Models = require('../Models');

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.Document
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
// const findAll = (criteria, projection = {}, options = {}) => Models.Training
//   .find(criteria, projection, options);
const findAll = (criteria, projection = {}, options = null, cb) => {
  const query = Models.Document.find(criteria, projection);
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

const findAllByAggregation = (
  criteria,
  projection,
  populate = [],
  sort,
  offset,
  limit,
  bucketId = null,
  cb,
) => {
  const query = [];
  if (bucketId) {
    query.push({
      $unwind: {
        path: '$buckets',
        // preserveNullAndEmptyArrays: true,
      },
    });
  }
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
  console.log("aggregate query", JSON.stringify(query))
  return Models.Document.aggregate(query, cb);
};
const aggregation = (query, cb) => Models.Document.aggregate(query, cb);
const count = (criteria, cb) => Models.Document.countDocuments(criteria, cb);

const create = (objToSave, cb) => new Models.Document(objToSave).save(cb);

const createMany = (arrayToSave, cb) => Models.Document.insertMany(arrayToSave, { lean: true }, cb);

const update = (criteria, dataToSet, options = {}, cb) => Models.Document
  .findOneAndUpdate(criteria, dataToSet, options, cb);

const updateAll = (criteria, dataToSet, options, cb) => Models.Document
  .updateMany(criteria, dataToSet, options, cb);

const aggregateStats = (
  criteria,
  populate = [],
  cb,
) => {
  const query = [];
  const { tenantId, createdAt = null } = criteria;

  const tenantCriteria = { $match: { tenantId } };

  let dateCriteria = null;
  if (createdAt) {
    dateCriteria = {
      $match: {
        createdAt,
      },
    };
  }
  query.push(tenantCriteria);

  const configPopulate = [];
  populate.forEach((item) => {
    configPopulate.push({
      $lookup: {
        from: item.collection,
        localField: item.localField,
        foreignField: item.foreignField,
        as: item.outputKey,
      },
    });
  });

  // toatal uploads
  const totalUploads = {
    totalUploads: [
      {
        $group: {
          _id: null,
          data: { $sum: 1 },
        },
      },
    ],
  };

  // total uploads by AI Status
  const totalUploadsByStatus = {
    totalUploadsByStatus: [
      {
        $group: {
          _id: '$aiStatus',
          data: {
            $sum: 1,
          },
        },
      },
    ],
  };

  // uploads by date
  const uploadsByDate = {
    uploadsByDate: [
      {
        $group: {
          _id: null,
          data: { $sum: 1 },
        },
      },
    ],
  };

  // uploads by date & config
  const uploadsByDateAndConfig = {
    uploadsByConfig: [
      {
        $match: {
          configId: { $exists: true, $ne: null },
        },
      },
      ...configPopulate,
      {
        $project: {
          name: { $arrayElemAt: ['$configData.name', 0] },
        },
      },
      {
        $match: {
          name: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$name',
          data: { $sum: 1 },
        },
      },
    ],
  };

  // uploads by date & doc type
  const uploadsByDateAndDocType = {
    uploadsByDocType: [
      { $match: { docType: { $ne: null } } },
      {
        $group: {
          _id: '$docType',
          data: { $sum: 1 },
        },
      },
    ],
  };

  // uploads by date & status
  const uploadsByDateAndStatus = {
    uploadsByStatus: [
      {
        $group: {
          _id: '$aiStatus',
          data: {
            $sum: 1,
          },
        },
      },
    ],
  };

  if (dateCriteria) {
    uploadsByDate.uploadsByDate.unshift(dateCriteria);
    uploadsByDateAndConfig.uploadsByConfig.unshift(dateCriteria);
    uploadsByDateAndDocType.uploadsByDocType.unshift(dateCriteria);
    uploadsByDateAndStatus.uploadsByStatus.unshift(dateCriteria);
  }

  query.push({
    $facet: {
      ...totalUploads,
      ...totalUploadsByStatus,
      ...uploadsByDate,
      ...uploadsByDateAndStatus,
      ...uploadsByDateAndConfig,
      ...uploadsByDateAndDocType,
    },
  });
  return Models.Document.aggregate(query, cb);
};

const deleteMany = (criteria, cb) => Models.Document
  .deleteMany(criteria, cb);
const fetchDistinct = (field, criteria, callback) => {
  Models.Document.distinct(field, criteria, callback)
}
module.exports = {
  findAll,
  findOne,
  findAllByAggregation,
  update,
  updateAll,
  create,
  createMany,
  count,
  aggregateStats,
  aggregation,
  deleteMany,
  fetchDistinct
};
