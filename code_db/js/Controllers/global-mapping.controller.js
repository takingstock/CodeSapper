/* eslint-disable comma-dangle */
const config = require('config');
const { auto, eachSeries } = require('async');
const {
  createMongooseId,
  slugify,
  capitalise
} = require('../Utils/universal-functions.util');
const {
  globalMappingService,
  workflowService
} = require('../Services');
const { GLOBAL_MAPPING_MOCK } = require('../Mock/global-mapping.mock');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const ERR_MESSAGES = config.get('ERR_MESSAGES');

/**
 * fetch individual mapping details
 * @param {object} userInfo
 * @param {object} queryParams
 * @param {object} browserInfo
 * @returns
 */
const mappingFetchDetail = (
  {
    tenantId
  },
  {
    id: mappingId,
  },
  {
    tenantId: tenant
  },
  hcb
) => {
  tenantId = tenantId || tenant
  const criteria = {
    _id: mappingId
  };
  if (tenantId) {
    criteria.tenantId = tenantId
  }
  const projection = {
    documentType: 1,
    docCategory: 1,
    mapping: 1,
    isTablePresent: 1,
    isUserDefined: 1,
    isDefaultDoc: 1,
    columns: 1,
    docSlug: 1,
    static: 1,
    importedFrom: 1,
    tenantId: 1
  };

  globalMappingService.findOne(criteria, projection, (err, result) => {
    if (err) {
      return hcb(err);
    }
    // TODO remove this line of code
    // result.columns = result.columns.map(m => m.key)
    // comments
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: result
    });
  });
};

/**
 * fetch individual mapping details by docType
 * @param {object} userInfo
 * @param {object} queryParams
 * @param {object} browserInfo
 * @returns
 */
const mappingFetchByDoc = (
  {
    tenantId
  },
  {
    documentType = null
  },
  hcb
) => {
  const criteria = {
    documentType,
    tenantId
  };
  const projection = {
    documentType: 1,
    docCategory: 1,
    mapping: 1,
    isTablePresent: 1,
    isUserDefined: 1,
    isDefaultDoc: 1,
    docSlug: 1,
  };
  globalMappingService.findOne(criteria, projection, (err, response) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: response?.mapping || [],
    });
  });
};

/**
 * fetch all mappings
 * @param {object} userInfo
 * @param {object} browserInfo
 * @returns
 */
const mappingFetch = (
  {
    tenantId
  },
  {
    q = '',
    limit = 10,
    offset = 0,
    sortBy = 'createdAt',
    orderBy = 'DESC',
    docCategory = null,
    mappingType = 'none',
    tenantId: tenant
  },
  hcb
) => {
  tenantId = tenantId || tenant
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  let criteria = {
    isDeleted: false,
  };
  if (tenantId) {
    criteria.tenantId = createMongooseId(tenantId)
  }
  if (docCategory) {
    criteria = {
      ...criteria,
      docCategory
    };
  }

  if (mappingType === 'default') {
    criteria.isDefaultDoc = true;
    criteria.static = false;
  }
  if (mappingType === 'custom') {
    criteria.isDefaultDoc = false;
  }
  if (mappingType === 'static') {
    criteria.static = true;
  }
  const projection = {
    columns: 1,
    documentType: 1,
    docCategory: 1,
    mapping: 1,
    isTablePresent: 1,
    isUserDefined: 1,
    isDefaultDoc: 1,
    createdAt: 1,
    updatedAt: 1,
    docSlug: 1,
    seedId: 1,
    static: 1,
    importedFrom: 1,
    tenantId: 1
  };
  if (q) {
    criteria = {
      ...criteria,
      documentType: {
        $regex: q,
        $options: 'i'
      },
    };
  }

  globalMappingService.findAllByAggregation(
    criteria,
    projection,
    [],
    sortObj, offset, limit,
    (err, results) => {
      if (err) {
        return hcb(err)
      }
      const { dataList = [], count } = results[0];
      const totalCount = count[0] && count[0].count ? count[0].count : 0;
      const data = {
        list: dataList.map((item) => {
          if (!item.docCategory) {
            return {
              documentType: capitalise(item.documentType),
              ...item,
              isDefaultDoc: !!item.isDefaultDoc,
              docCategory: '',
            };
          }
          return {
            documentType: capitalise(item.documentType),
            isDefaultDoc: !!item.isDefaultDoc,
            ...item,
          };
        }),
        totalCount,
      }
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data
      });
    }
  );
};

/**
 * create new mapping
 * @param {object} userInfo
 * @param {object} payload
 * @param {object} queryParams
 * @returns
 */
const mappingCreate = ({
  id,
  tenantId
}, {
  documentType: docType,
  docCategory,
  isTablePresent = false,
  isUserDefined = false,
  mapping: inputMapping,
  columns: inputColumns = [],
  importedFrom = null,
  tenantId: tenant
},
  hcb) => {
  tenantId = tenantId || tenant
  const mappedInputMapping = inputMapping.map((item) => ({
    ...item,
    exportKey: item.exportKey || item.key,
    slug: slugify(item.key),
    isRequired: !!item.isRequired,
  }));

  const inputColumnsMapping = inputColumns.map(item => {
    if (typeof item === "string") {
      return ({
        exportKey: item,
        slug: slugify(item),
        isRequired: true,
        key: item,
        threshHoldConfidenceScore: 80,
        dataType: "alphanumeric"
      })
    }
    return ({
      ...item,
      exportKey: item.exportKey || item.key,
      slug: slugify(item.key),
      isRequired: !!item.isRequired,
    })
  })

  auto({
    checkDocType: (cb) => {
      const criteria = {
        documentType: docType,
        tenantId
      };
      const projection = { documentType: 1 };
      globalMappingService.findOne(criteria, projection, (err, response) => {
        if (response) {
          return cb({ statusCode: 404, message: ERR_MESSAGES.DOCUMENT_TYPE_ALREADY_EXIST });
        }
        let payloadBody = {
          docCategory,
          documentType: docType,
          docSlug: slugify(docType),
          isTablePresent,
          tenantId,
          createdBy: id,
          isUserDefined,
          importedFrom
        };
        if (mappedInputMapping.length) {
          payloadBody = {
            ...payloadBody,
            mapping: mappedInputMapping
          };
        }
        if (inputColumnsMapping.length) {
          payloadBody.columns = inputColumnsMapping
        }
        return cb(null, payloadBody);
      });
    },
    createmapping: ['checkDocType', (results, cb) => {
      const payloadBody = results.checkDocType;
      globalMappingService.create(payloadBody, (err, response) => {
        if (err) {
          return cb(err);
        }
        const {
          _id,
          documentType,
          mapping,
          isDefaultDoc = false,
          columns: cols = [],
          docSlug,
        } = response || {};
        return cb(null, {
          ...HTTP_SUCCESS_MESSAGES.CONFIG_SUCCESS,
          data: {
            _id,
            docCategory,
            documentType,
            docSlug,
            columns: cols,
            mapping,
            isDefaultDoc,
          },
        });
      });
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.createmapping);
  });
};

/**
 * update the enterprise mapping
 * @param {object} userInfo
 * @param {object} payload
 * @param {object} params
 * @param {string} query
 * @returns
 */
const mappingUpdate = ({
  id,
  tenantId,
  role
}, payload,
  { id: mappingId },
  hcb) => {
  tenantId = tenantId || payload.tenantId
  const criteria = {
    _id: mappingId
  };
  if (tenantId) {
    criteria.tenantId = tenantId
  }
  let dataToSet = {
    ...payload,
    updatedBy: id,
  };
  if (payload.documentType) {
    dataToSet = {
      ...dataToSet,
      documentType: payload.documentType,
      docSlug: slugify(payload.documentType),
    };
  }
  if (payload.mapping) {
    dataToSet = {
      ...dataToSet,
      mapping: payload.mapping.map((item) => ({
        ...item,
        exportKey: item.exportKey || item.key,
        slug: slugify(item.key),
      })),
    };
  }
  if (payload.columns) {
    dataToSet.columns = payload.columns.map(item => {
      if (typeof item === "string") {
        return ({
          exportKey: item,
          slug: slugify(item),
          key: item,
          isRequired: true,
          dataType: "alphanumeric",
          threshHoldConfidenceScore: 80
        })
      }
      return ({
        ...item,
        exportKey: item.exportKey || item.key,
        slug: slugify(item.key),
        isRequired: !!item.isRequired,
      })
    })
  }
  auto({
    checkMapping: (cb) => {
      if (role === "SUPER_ADMIN") { // no validation let update all config and values
        return cb()
      }
      globalMappingService.findOne(criteria, { documentType: 1 }, null, null, (e, config) => {
        if (e) {
          return cb(e)
        }
        if (config.documentType === "Invoices Custom") { // editable only threshHoldConfidenceScore for kv
          const setData = {}
          if (dataToSet.mapping) {
            const threshHoldscore = {}
            dataToSet.mapping.forEach(e => { // retain new cnfidence score
              threshHoldscore[e.key] = e.threshHoldConfidenceScore
            })
            dataToSet.mapping = config.mapping // retain old keys only
            dataToSet.mapping.forEach(e => {
              if (threshHoldscore[e.key]) { // update new confidence score if availabe
                e.threshHoldConfidenceScore = threshHoldscore[e.key]
              }
            })
          }
          if (dataToSet.columns) {
            setData.columns = dataToSet.columns
          }
          dataToSet = setData
        }
        if (config.documentType === "BOL") {
          if (dataToSet.columns) {
            dataToSet = { mapping: dataToSet.mapping, columns: dataToSet.columns }
          } else {
            dataToSet = {}
          }
        }
        cb(null, config)
      })
    },
    checkDocType: (cb) => {
      if (!payload.documentType) {
        return cb()
      }
      const criteria = {
        documentType: payload.documentType,
        tenantId,
        _id: { $nin: [createMongooseId(mappingId)] }
      };
      const projection = { documentType: 1 };
      console.log("Criterai: ", criteria)
      globalMappingService.findOne(criteria, projection, null, null, (err, response) => {
        if (response) {
          return cb({ statusCode: 404, message: ERR_MESSAGES.DOCUMENT_TYPE_ALREADY_EXIST });
        }
        cb()
      });
    },
    updateMapping: ["checkMapping", "checkDocType", ({ checkMapping }, cb) => {
      if (!dataToSet || !(Object.keys(dataToSet)[0])) {
        console.log("NOthing updated")
        return cb(null, checkMapping)
      }
      console.log("globalmapping: ", JSON.stringify(dataToSet))
      globalMappingService.update(criteria, { $set: dataToSet }, { new: true }, (err, result) => {
        if (err) {
          return hcb(err);
        }
        const {
          _id,
          documentType,
          mapping,
          docCategory,
          docSlug,
          isDefaultDoc = false,
          columns = [],
        } = result || {};
        return cb(null, {
          _id,
          docCategory,
          documentType,
          docSlug,
          columns,
          mapping,
          isDefaultDoc,
        });
      });
    }]
  }, (e, { updateMapping }) => {
    if (e) {
      return hcb(e)
    }
    hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.UPDATED,
      data: updateMapping
    })
  })
};

/**
 * mapping delete
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const mappingDelete = ({
  id,
  tenantId
}, {
  recordIds
}, callback) => {
  const criteria = {
    tenantId,
    _id: {
      $in: recordIds,
    },
  };
  auto({
    deleteDocMapping: (cb) => {
      globalMappingService.remove(criteria,
        (err) => {
          if (err) {
            return cb(err)
          }
          return cb()
        });
    },
    workflow: (cb) => {
      eachSeries(recordIds, (recordId, ecb) => {
        const criteria = {
          "docIds.docId": recordId
        }
        const pullDoc = { $pull: { docIds: { docId: recordIds } } }
        workflowService.updateAll(criteria, pullDoc, null, ecb)
      }, cb)
    }
  }, (err) => {
    if (err) {
      return callback(err);
    }
    return callback(null, {
      ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
      data: recordIds,
    });
  })
};

/**
 * create new mapping on User Register
 * @param {object} userInfo
 * @param {object} payload
 * @param {object} queryParams
 * @returns
 */
const mappingCreateCallback = ({
  userId,
  tenantId
}, hcb) => {
  const dataToSave = GLOBAL_MAPPING_MOCK.map((item) => ({
    isDefaultDoc: item.isDefaultDoc,
    documentType: item.documentType,
    docCategory: item.docCategory,
    tenantId,
    createdBy: userId,
    mapping: item.mapping.map((mappingKey) => ({
      ...mappingKey,
      exportKey: mappingKey.exportKey || mappingKey.key,
      slug: slugify(mappingKey.key),
    })),
    docSlug: slugify(item.documentType),
    seedId: item.seedId,
    static: item.static || false
  }));
  globalMappingService.createMany(dataToSave, (err, result) => {
    console.log("wdondddd", err, result)
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: result,
    });
  });
};

/**
 * create or update new mapping on app start
 * @param {object} userInfo
 * @param {object} payload
 * @param {object} queryParams
 * @returns
 */
const mappingUpdateCreateCallback = ({
  userId,
  tenantId
}, hcb) => {
  const dataToSave = GLOBAL_MAPPING_MOCK.map((item) => ({
    ...item,
    tenantId,
    createdBy: userId,
    mapping: item.mapping.map((mappingKey) => ({
      ...mappingKey,
      exportKey: mappingKey.exportKey || mappingKey.key,
      slug: slugify(mappingKey.key),
    })),
    docSlug: slugify(item.documentType),
    static: item.static || false
  }));
  // console.log("DATA TO SAVE >LENGTH", dataToSave.length)
  eachSeries(dataToSave, (item, cb) => {
    globalMappingService.findOne({ tenantId: item.tenantId, seedId: item.seedId }, null, null, null, (err, mapping) => {
      if (mapping) {
        globalMappingService.update({ tenantId: item.tenantId, seedId: item.seedId }, { $set: item }, null, cb)
      } else {
        globalMappingService.create(item, cb)
      }
    })
  }, () => {
    // console.log("UPDATE MAPPING", err)
    globalMappingService.findAll({ tenantId }, null, null, hcb)
  })
};

const aggregateStats = (tenantId, {
  fromDate = null,
  toDate = null
}, hcb) => {
  let criteria = {
    tenantId: createMongooseId(tenantId),
    isUserDefined: true,
  };
  if (fromDate && toDate) {
    criteria = {
      ...criteria,
      createdAt: {
        $gte: fromDate,
        $lte: toDate,
      },
    };
  }
  globalMappingService.aggregateStats(criteria, (err, result) => {
    if (err) {
      return hcb(err);
    }
    const [docsResponse] = result;
    const mappedResponse = docsResponse.docs.map((item) => ({
      name: item._id,
      count: item.data,
    }));
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: mappedResponse,
    });
  });
};

module.exports = {
  mappingFetch,
  mappingFetchDetail,
  mappingFetchByDoc,
  mappingUpdate,
  mappingCreate,
  mappingDelete,
  aggregateStats,
  mappingCreateCallback,
  mappingUpdateCreateCallback
};
