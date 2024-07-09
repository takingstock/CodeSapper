const config = require('config');
const { auto } = require('async');
const { performance } = require('perf_hooks');
const moment = require('moment');
const path = require('path');

const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const uploadController = require('./upload.controller');
const healthController = require('./health.controller')
const idpKeyController = require('./idp-key.controller')
const BATCH_INFO = require('../Models/idp-info.model')
const TENANT_SETTINGS = require('../Models/tenant-setting.model')
const IDPKEY = require('../Models/idp-key.model');

const { createMongooseId } = require('../Utils/universal-functions.util');
const {
  documentService,
  idpService,
  logsService,
  workflowService,
  globalMappingService
} = require('../Services');
const {
  processAiOnDocuments,
  customiseDocumentsForProcessing,
  documentsBucketization
} = require('../Helpers/process-ocr-upload');

const AI_STATUS = config.get('AI_STATUS');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const UPLOAD_INPUT_KEY = config.get('UPLOAD_INPUT_KEY');
const DB_DOC_TYPE = config.get('DB_DOC_TYPE');
const APP_EVENTS = config.get('APP_EVENTS');
const HOST = config.get("HOST")
const PUBLIC_API_ENDPOINTS = [
  { endpoint: "api/v2/processOcrUpload", type: "OCR UPLOAD", method: "POST" },
  { endpoint: "api/v2/processOcrUpload", type: "OCR UPLOAD LINE ITEMS", method: "POST" },
  { endpoint: "api/v2/ocrUploadStatus", type: "OCR STATUS", method: "GET" }
]
const docProjection = {
  status: "$aiStatus",
  review: "$qcStatus",
  fileOriginalName: 1,
  ocrRequestTime: 1,
  ocrResponseTime: 1,
  docType: 1,
  "docId": "$external.docId",
  "batchId": "$external.batchId",
  "pageArray.pageNo": 1,
  "pageArray.page_type": 1,
  "pageArray.pageImageLink": 1,
  "pageArray.dimension": 1,
  "pageArray.nonTabularContent.confidence_score": 1,
  "pageArray.nonTabularContent.global_key": 1,
  "pageArray.nonTabularContent.data_type": 1,
  "pageArray.nonTabularContent.mandatory": 1,
  "pageArray.nonTabularContent.local_value.text": 1,
  "pageArray.nonTabularContent.local_value.pts": 1,
  "pageArray.nonTabularContent.local_value.edited_value": 1,
  "pageArray.tabularContent.cell_info": 1,
  "pageArray.tabularContent.hdr_row": 1,
  createdAt: 1,
  updatedAt: 1,
  confidenceScore: 1,
  isBatchReviewed: 1
}
// ///////////////////////////////Helpings function//////////////////////////////////////////////////
const saveLogs = (logs, code, error = null, { documents = [] }, cb) => {
  if (logs.responseTime) {
    logs.responseTime = new Date().getTime();
  }
  if (code) {
    logs.statusCode = code
  }
  if (documents && documents.length) {
    logs.payload.files = documents.map(file => ({
      fileOriginalName: file.fileOriginalName,
      fileName: file.fileName,
      fileSize: file.fileSize,
      fileExtension: file.fileExtension
    }))
  }
  if (error) {
    logs.error = error
  }
  if (!logs._id) {
    logsService.create(logs, (err, res) => {
      console.log("LOG SAVED", !err)
      cb(err, res)
    });
  } else {
    const cond = { _id: logs._id };
    delete logs._id
    logsService.update(cond, { $set: logs }, { new: true }, (err, res) => {
      console.log("LOG UPDATED", !err)
      cb(err, res)
    });
  }
}
/**
 * Documents Extract Via AI
 * @param {*} idpId
 * @param {*} hcb
 */
const _documentsExtractViaAI = (idpId, hcb) => {
  auto({
    UNPROCESS_DOCUMENTS: (cb) => {
      documentService.findAll({
        idpId,
        isDeleted: false,
        aiStatus: { $in: [AI_STATUS.OCR_PENDING, AI_STATUS.FEEDBACK_PENDING] },
      }, {}, {}).then((result) => {
        if (result && result.length) {
          cb(null, result)
        } else {
          cb("no data to process");
        }
      }).catch(err => cb(err));
    },
    mappedUnprocessedDocuments: ['UNPROCESS_DOCUMENTS', (result, cb) => {
      customiseDocumentsForProcessing(result.UNPROCESS_DOCUMENTS)
        .then((res) => {
          if (res && res.length) {
            return cb(null, res);
          }
          return cb({ message: "no data to process" });
        })
        .catch(err => {
          cb(err)
        });
    }],
    processAi: ["mappedUnprocessedDocuments", ({ mappedUnprocessedDocuments }, cb) => {
      if (mappedUnprocessedDocuments && mappedUnprocessedDocuments.length) {
        processAiOnDocuments(mappedUnprocessedDocuments)
          .then(result => {
            cb(null, result)
          })
          .catch(err => cb(err));
      }
    }]
  }, (err, { processAi }) => {
    if (err) {
      console.log("ERRR _documentsExtractViaAI", err)
      return hcb(null, false);
    }
    return hcb(null, processAi);
  })
}
/**
 * Create documents and batch
 * @param {*} idpId
 * @param {*} filesArray
 * @param {*} workflowId
 * @param {*} hcb
 */
const _saveDocuments = (
  { id, tenantId = null, step = 8, uploadedDocType = "Invoices Custom", tableHeaders = [] },
  idpId = null,
  filesArray,
  workflowId = null,
  hcb,
) => {
  const validFiles = filesArray
    .filter((item) => !item.folderName)
    .map((item) => item.files)
    .flat();
  const extractedFiles = filesArray.filter((item) => item.folderName);
  const allFiles = filesArray.map((item) => item.files).flat();
  auto({
    // fetch batch exist
    batchCount: (cb) => {
      idpService.countDocuments({ tenantId, isDeleted: false, api: true }, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result + 1);
      });
    },
    // create batch
    createBatch: ['batchCount', (results, cb) => {
      if (!idpId) {
        const serialNo = `Batch_${results.batchCount}`;
        const payload = {
          createdBy: id,
          tenantId,
          workflowId,
          filesCount: allFiles.length,
          filesUploadedCount: allFiles.length,
          extractedFiles,
          validFiles,
          name: serialNo,
          step,
          api: true,
          uploadedDocType
          // bath_no: new Date("dd/mm/yy")
        };
        const externalBatchId = allFiles[0] && allFiles[0].fileOriginalName && allFiles[0].fileOriginalName.split('-')[0]
        if (externalBatchId) {
          payload.externalBatchId = externalBatchId
        }
        return idpService.create(payload, (err, result) => {
          if (err) {
            return cb(err);
          }
          const {
            extractedFiles: extractedDataArrays,
            validFiles: validFilesArray, name: batchId, _id, filesCount,
          } = result;
          const mappedDocuments = allFiles.map((file) => ({
            s3Url: file.s3Url || '',
            fileOriginalName: file.fileOriginalName,
            fileName: file.fileName,
            fileSize: file.fileSize,
            filePath: file.filePathToSave,
            fileExtension: file.fileExtension,
            external: {
              batchId: (file.fileOriginalName && file.fileOriginalName.split('-')[0]) || 0,
              docId: (file.fileOriginalName && file.fileOriginalName.split('-')[1]) || 0,
              headers: tableHeaders
            },
            externalId: file.fileOriginalName,
            aiStatus: AI_STATUS.OCR_PENDING,
            idpId: _id,
            configId: workflowId,
            tenantId,
            createdBy: id,
            mapping: {
              'Document name': file.fileOriginalName,
              'Document size': file.fileSize,
              'Document extension': file.fileExtension,
              'Document type': null,
              'AI status': AI_STATUS.OCR_PENDING,
            },
            api: true,
            uploadedDocType
          }));
          return cb(null, {
            idpId: _id,
            batchId,
            documentsToSave: mappedDocuments,
            response: {
              batchId,
              filesCount,
              extractedDataArrays,
              validFilesArray,
            },
          });
        });
      }
      return cb(null, {
        idpId,
      });
    }],
    // saved documents
    saveDocuments: ['createBatch', (results, cb) => {
      const {
        documentsToSave: mappedDocuments = [],
      } = results.createBatch;
      documentService.createMany(mappedDocuments, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results);
  });
};

// ////////////////////////////////////route handlers
/**
 * Document details viva api only
 * @param {*} param0
 * @param {*} hcb
 */
const documentDetails = (_, hcb) => {
  hcb(null, "comming soon");
  // workflowService.findAll({ tenantId }, { workflow: 1 }, null, hcb)
}
const _checkExtension = (fileName) => path.extname(fileName);

/**
 * DOcuments list
 * @param {*} param
 * @param {*} hcb
 */
const documentList = ({ tenantId }, {
  q = '', limit = 10, offset: skip = 0, isAssigned = false, sortBy = 'createdAt', orderBy = 'DESC', status = null,
  score = null, configId = null, apiBatch = null, isIdentified = null, bucketId = null,
  isFeedbackApplied = false, isNonIdentified = false, corruptFiles = false
}, hcb) => {
  const sort = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  let criteria = {
    isDeleted: false,
    opType: DB_DOC_TYPE.PROCESSING,
  };
  if (tenantId) {
    criteria.tenantId = createMongooseId(tenantId);
  }
  if (configId) {
    criteria.configId = createMongooseId(configId);
  }
  if (isFeedbackApplied) {
    criteria = {
      ...criteria,
      buckets: {
        $elemMatch: {
          isFeedbackAppliedOn: true,
          isTaggedAsTrainingDoc: false
        },
      },
    };
  }
  if (q) {
    criteria = {
      ...criteria,
      $and: [
        {
          $or: [
            {
              fileOriginalName: { $regex: q, $options: 'i' },
            },
            {

              docType: { $regex: q, $options: 'i' },
            },
          ],
        },
      ],
    };
  }
  if (isAssigned) {
    criteria = {
      ...criteria,
      status: 'ASSIGNED',
    };
  }
  if (status) {
    const statusArray = status.split(',').map((item) => item.trim());
    criteria = {
      ...criteria,
      aiStatus: { $in: statusArray },
    };
    if (status === AI_STATUS.OCR_DONE) {
      criteria = {
        ...criteria,
        aiStatus: { $nin: [AI_STATUS.OCR_FAILED] },
      }
    }
  }
  if (score) {
    let high; let medium; let low = null;
    score.split(',').map((item) => item.trim()).forEach((item) => {
      if (item === 'HIGH') {
        high = 'HIGH';
      } else if (item === 'MEDIUM') {
        medium = 'MEDIUM';
      } else if (item === 'LOW') {
        low = 'LOW';
      }
    });
    if (high || medium || low) {
      criteria = {
        ...criteria,
        confidenceScore: { $exists: true },
      };
    }
    if (high && medium) {
      criteria = {
        ...criteria,
        confidenceScore: { $gte: 75 },
      };
    } else if (high && low) {
      criteria = {
        ...criteria,
        $and: [
          ...(criteria.$and || []),
          { $or: [{ confidenceScore: { $gte: 85 } }, { confidenceScore: { $lt: 75 } }] },
        ],
      };
    } else if (medium && low) {
      criteria = {
        ...criteria,
        confidenceScore: { $lt: 85 },
      };
    } else if (high) {
      criteria = {
        ...criteria,
        confidenceScore: { $gte: 85 },
      };
    } else if (medium) {
      criteria = {
        ...criteria,
        $and: [
          ...(criteria.$and || []),
          { $and: [{ confidenceScore: { $gte: 75 } }, { confidenceScore: { $lt: 85 } }] },
        ],
      };
    } else if (low) {
      criteria = {
        ...criteria,
        confidenceScore: { $lt: 75 },
      };
    }
  }
  if (apiBatch) {
    criteria = {
      ...criteria,
      apiBatch,
    };
  }
  if (typeof isIdentified === 'boolean') {
    if (!isIdentified) {
      criteria = {
        ...criteria,
        $and: [
          ...(criteria.$and || []),
          {
            $or: [
              {
                isTableFlag: false,
              },
              {
                isNonTableFlag: false,
              },
            ],
          },
        ],
      };
    } else {
      criteria = {
        ...criteria,
        isTableFlag: true,
        isNonTableFlag: true,
      };
    }
  }

  if (bucketId) {
    criteria = {
      ...criteria,
      buckets: {
        $elemMatch: {
          bucketId,
          isFeedbackAppliedOn: false,
        },
      },
    };
  }
  if (isNonIdentified) {
    criteria = {
      ...criteria,
      buckets: {
        $elemMatch: {
          isFeedbackAppliedOn: false,
          isTaggedAsTrainingDoc: false
        },
      },
      $or: [
        {
          isTableFlag: false,
        },
        {
          isNonTableFlag: false,
        },
      ]
    };
  }

  if (corruptFiles) {
    criteria = {
      ...criteria,
      corruptFile: true
    }
  } else {
    criteria = {
      ...criteria,
      corruptFile: false
    }
  }

  documentService.aggregation(
    [
      { $match: { ...criteria } },
      // {
      //   $lookup: {
      //     from: 'batchinfos',
      //     localField: 'apiBatch',
      //     foreignField: 'batchName',
      //     as: 'idpData',
      //   }
      // },
      // {
      //   $unwind: "$idpData"
      // },
      // {
      //   $match: { "idpData.tenantId": createMongooseId(tenantId) }
      // },
      {
        $facet: {
          documents: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
          count: [
            {
              $group: {
                count: { $sum: 1 },
                _id: null,
              },
            },
          ]
        }
      }
    ], (err, result) => {
      if (err) {
        return hcb(err)
      }
      const { documents: data, count } = result[0];

      hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data,
        totalCount: count[0] && count[0].count ? count[0].count : 0
      });
    }
  );
}

const batchList = ({ tenantId }, { offset: skip = 0, limit = 10, sortBy = "batchName", orderBy = 'DESC' }, hcb) => {
  const sort = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  try {
    const aggregate = [
      { $match: { tenantId: createMongooseId(tenantId), apiBatch: { $nin: ['none'] } } },
      { $group: { _id: "$apiBatch", documents: { $push: "$$ROOT" } } },
      {
        $lookup: {
          from: 'batchinfos',
          localField: '_id',
          foreignField: 'batchName',
          as: 'batch',
        }
      },
      { $unwind: "$batch" },
      {
        $match: { "batch.tenantId": createMongooseId(tenantId) }
      },
      {
        $project: {
          batchName: "$batch.batchName",
          createdAt: '$batch.createdAt',
          feedbackGiven: '$batch.feedbackGiven',
          _id: '$batch._id',
          total: {
            $size: '$documents'
          }
        }
      },
      {
        $facet: {
          batches: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
          count: [
            {
              $group: {
                count: { $sum: 1 },
                _id: null,
              },
            },
          ]
        }
      }
    ]
    documentService.aggregation(aggregate, (err, result) => {
      console.log("ERROR", err)
      if (err) {
        return hcb(err)
      }
      const { batches: data, count } = result[0];
      hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data,
        totalCount: count[0] && count[0].count ? count[0].count : 0
      });
    });
  } catch (error) {
    console.log("ERROR", error);
    hcb(error);
  }
}
// { batchTo: {  gte:8 },batchFrom:{ lte:8} }

// { batchTo: {  gte:11 },batchFrom:{ lte:11} }
const _isBatchAvailable = ({ from, to, tenantId }, hcb) => {
  auto({
    checkFrom: (cb) => {
      BATCH_INFO.findOne({ tenantId, batchTo: { $gte: from }, batchFrom: { $lte: from } }, cb);
    },
    checkTo: (cb) => {
      BATCH_INFO.findOne({ tenantId, batchTo: { $gte: to }, batchFrom: { $lte: to } }, cb);
    }
  }, (err, { checkFrom, checkTo }) => {
    if (err) {
      return hcb(err);
    }
    if (!!checkFrom || !!checkTo) {
      return hcb(null, false);
    }
    return hcb(null, true);
  })
}

const verifyBatch = ({ tenantId }, payload, hcb) => {
  let query = { $or: [{ isTableFlag: false }, { isNonTableFlag: false }] }
  auto({
    flag: (cb) => {
      _isBatchAvailable({ tenantId, from: new Date(payload.from).getTime(), to: new Date(payload.to).getTime() }, cb);
    },
    count: ['flag', ({ flag }, cb) => {
      if (!flag) {
        return cb(null, false)
      }
      query = {
        ...query,
        apiBatch: "none",
        tenantId: createMongooseId(tenantId),
        createdAt: { $gte: moment(payload.from).toDate(), $lt: moment(payload.to).add(1, 'days').toDate() },
      }
      console.log(JSON.stringify(query));
      documentService.aggregation([{ $match: query }, {
        $group: {
          _id: null,
          count: { $sum: 1 },
        },
      }], cb);
    }]
  }, (_, { flag, count }) => {
    if (flag) {
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: {
          batchAvailable: true,
          count: (count && count[0] && count[0].count) || 0
        }
      });
    }
    hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: {
        batchAvailable: false,
        count: 0
      },
    });
  });
}
const createbatch = ({ tenantId }, payload, hcb) => {
  let query = { $or: [{ isTableFlag: false }, { isNonTableFlag: false }] };
  let batchName = null;
  if (payload.workflowId) {
    query.workflowId = payload.workflowId;
  }
  auto({
    checkBatch: (cb) => {
      _isBatchAvailable({ tenantId, from: new Date(payload.from).getTime(), to: new Date(payload.to).getTime() }, (err, flag) => {
        if (!flag) {
          return cb({ ...HTTP_ERROR_MESSAGES.NOT_FOUND, message: "batch not available" });
        }
        cb(null, flag);
      })
    },
    bucketApiHealth: ['checkBatch', (_, cb) => {
      healthController.health((err, { data = [] }) => {
        if (err) {
          return cb(err);
        }
        const bucketServer = data.filter(d => d.name === 'BUCKET SERVER')[0];
        if (!bucketServer || bucketServer.message === 'Server Down') {
          return cb({ statusCode: 500, message: 'Bucketing ai server is down try again later' });
        }
        return cb(null, true);
      })
    }],
    batchCount: ['bucketApiHealth', (_, cb) => {
      BATCH_INFO.countDocuments({ tenantId }, (err, result) => {
        if (err) {
          return cb(err);
        }
        batchName = `Training_Batch_${result + 1}`;
        return cb(null, result + 1);
      })
    }],
    saveBatchInfo: ['batchCount', (_, cb) => {
      const data = {
        batchFrom: new Date(payload.from).getTime(),
        batchTo: new Date(payload.to).getTime(),
        tenantId,
        batchName
      }
      const BatchInfo = new BATCH_INFO(data);
      BatchInfo.save(cb);
    }],
    generateBatch: ['saveBatchInfo', (_, cb) => {
      query = {
        ...query,
        apiBatch: "none",
        tenantId,
        createdAt: { $gte: moment(payload.from).toDate(), $lt: moment(payload.to).add(1, 'days').toDate() },

      }
      console.log("UPDATE QUERY");
      documentService.updateAll({ ...query }, { $set: { apiBatch: batchName } }, null, cb);
    }],
    bucketization: ['generateBatch', (_, cb) => {
      documentsBucketization({ tenantId }, { apiBatch: batchName }, cb);
    }],
    batchList: ['bucketization', (_, cb) => {
      documentService.aggregation(
        [
          { $match: { tenantId: createMongooseId(tenantId), apiBatch: batchName } },
          { $group: { _id: "$apiBatch", documents: { $addToSet: "$$ROOT" } } },
          {
            $lookup: {
              from: 'batchinfos',
              localField: '_id',
              foreignField: 'batchName',
              as: 'batch',
            }
          },
          { $unwind: "$batch" },
          {
            $match: { "batch.tenantId": createMongooseId(tenantId) }
          },
          {
            $project: {
              batchName: "$batch.batchName",
              createdAt: '$batch.createdAt',
              _id: '$batch._id',
              total: {
                $size: '$documents'
              },
              feedbackGiven: '$batch.feedbackGiven'
            }
          }
        ], cb
      );
    }],
  }, (err, { batchList }) => {
    if (err) {
      return hcb(err)
    }
    hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: batchList[0]
    })
  })
}

/**
 * process files
 * @param {Object} userInfo
 * @param {Object} payload
 * @param {Object} params
 * @param {Object} queryParams
 * @returns
 */
const processOcrUpload = (
  { id, tenantId },
  data,
  { id: idpId = null },
  { ip: ipAddress, file_id = null, logId = null },
  hcb,
) => {
  const { workflowId = null } = data;

  console.log("DATA DATA DATA", Object.keys(data))
  const startTime = performance.now(); // start uploading
  let files = Array.isArray(data[UPLOAD_INPUT_KEY])
    ? data[UPLOAD_INPUT_KEY] : [data[UPLOAD_INPUT_KEY]];
  if (!(files[0] && files[0].hapi && files[0].hapi.filename)) {
    files = []
  }
  const logs = {
    requestTime: new Date().getTime(),
    payload: {
      ...data,
      files: files.map(f => ({
        fileOriginalName: f.hapi.filename
      }))
    },
    workflowId,
    tenantId,
    ipAddress,
    externalId: file_id
  }
  if (!workflowId) {
    const error = {
      ...HTTP_ERROR_MESSAGES.NOT_FOUND,
      message: 'Workflow not found',
    }
    saveLogs(logs, 400, error, {}, () => {
      EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId });
    });
    return hcb(error);
  }
  if (logId) {
    logs._id = logId
    delete logs.requestTime
  } else {
    logs.endpoint = "api/ocr/processOcrUpload";
    logs.method = "POST";
  }
  const ext = files.map(f => _checkExtension(f.hapi.filename))
  if (ext.includes('.zip') || ext.includes('.rar')) {
    return hcb({ statusCode: 400, message: "Invalid file format" })
  }
  auto({
    uploadFiles: (cb) => {
      const uploadDir = uploadController.createPathDir({ id, tenantId });
      uploadController.upload(files, uploadDir)
        .then((result) => cb(null, result));
    },
    checkfileSize: ['uploadFiles', ({ uploadFiles }, cb) => {
      let filSizeInKb = uploadFiles.reduce((accumulator, object) => {
        return accumulator + object.fileSize;
      }, 0);
      filSizeInKb = filSizeInKb && (filSizeInKb / 1000)
      TENANT_SETTINGS.aggregate([{ $match: { tenantId: createMongooseId(tenantId) } }, {
        $lookup: {
          from: 'users',
          localField: 'tenantId',
          foreignField: 'tenantId',
          as: 'user'

        }
      }], (err, result) => {
        const Setting = result[0]

        if (err) {
          cb(err)
        } else {
          if (Setting && Setting.user) {
            const User = Setting.user[0]
            if (User && !User.isTrialAccount) {
              return cb(null, Setting)
            }
            if (filSizeInKb && filSizeInKb / 1000 <= 10) {
              return cb(null, Setting)
            }
            return cb({ statusCode: 403, message: `You can upload 10 mb with single request only` });
          }
          // Setting.storageUsed = Setting.storageUsed && 0
          const dataSize = filSizeInKb + ((Setting && Setting.storageUsed) || 0)
          const limit = ((Setting && Setting.storageLimit) || 25000)
          if (!Setting || dataSize <= limit) {
            return cb(null, Setting)
          }
          return cb({ statusCode: 403, message: `Storage capacity is low, ${limit - dataSize}` })
        }
      })
    }],
    saveDocuments: ['checkfileSize', (results, cb) => {
      _saveDocuments(
        { id, tenantId },
        idpId,
        results.uploadFiles,
        workflowId,
        (err, result) => {
          if (err) {
            return cb(err);
          }
          const { batchId, createBatch: batchDetails } = result;
          const endTime = performance.now();
          return cb(null, {
            batchId,
            documents: batchDetails.documentsToSave,
            idpId: batchDetails.idpId,
            timeUnit: 'milliseconds',
            timeConsumed: parseInt((endTime - startTime).toFixed(2), 10),
          });
        }
      );
    }],
    processOcr: ['saveDocuments', ({ saveDocuments }, cb) => {
      logs.idpId = saveDocuments.idpId
      saveLogs(logs, null, null, {}, (err, res) => {
        console.log("LOG saved processOcr", !err)
        if (res) {
          logs._id = res._id
        }
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId });
      });
      _documentsExtractViaAI(saveDocuments.idpId, cb)
    }],
    updateBatch: ['processOcr', ({ saveDocuments }, cb) => {
      const dataToSet = { step: 4 }
      if (file_id) {
        dataToSet.externalId = file_id
      }
      idpService.update({ _id: saveDocuments.idpId }, { $set: dataToSet }, null, cb)
    }],
    documents: ['updateBatch', ({ saveDocuments }, cb) => {
      documentService.findAll({
        idpId: saveDocuments.idpId
      }, { pageArray: 0 }, null, cb)
    }],
    saveFileSize: ['saveDocuments', ({ uploadFiles, checkfileSize }, cb) => {
      const filSizeInKb = uploadFiles.reduce((accumulator, object) => {
        return accumulator + object.fileSize;
      }, 0);
      if (!checkfileSize) {
        new TENANT_SETTINGS({ tenantId, storageUsed: filSizeInKb }).save(cb)
      } else {
        TENANT_SETTINGS.findOneAndUpdate({ tenantId }, { $inc: { storageUsed: filSizeInKb } }, cb)
      }
    }]
  }, (err, result) => {
    // console.log("processOcrprocessOcrprocessOcr",result)
    if (!logId) {
      logs.responseTime = true
    }
    const AiError = (result.processOcr && result.processOcr.filter((file) => file.error)) || []
    if (err) {
      saveLogs(logs, err.code || err.statusCode || 500, AiError || err, result, () => {
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId });
      });
      return hcb(err);
    }
    saveLogs(logs, 200, AiError, result, () => {
      EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId });
    });
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: result.documents });
  });
};
/**
 * workflow list for Tenant
 * @param {*} userInfo
 * @param {*} hcb
 */
const workflowList = ({ tenantId }, hcb) => {
  workflowService.findAll({ tenantId }, { workflow: 1 }, null, hcb)
}

const processOcrInbackground = ({ id, tenantId },
  data,
  { id: idpId = null },
  { ip, file_name: file_id, customer_id: externalCustomerId }, hcb) => {
  let files = Array.isArray(data[UPLOAD_INPUT_KEY])
    ? data[UPLOAD_INPUT_KEY] : [data[UPLOAD_INPUT_KEY]];
  if (!(files[0] && files[0].hapi && files[0].hapi.filename)) {
    files = []
  }
  const { workflowId = null, tableHeaders = [], docType: uploadedDocType = "Invoices Custom" } = data;
  const startTime = performance.now();
  const logs = {
    requestTime: new Date().getTime(),
    payload: {
      ...data,
      files: files.map(f => ({
        fileOriginalName: f.hapi.filename
      }))
    },
    workflowId: data.workflowId,
    tenantId,
    ipAddress: ip,
    endpoint: "api/ocr/ocrProcess",
    method: "POST",
    externalCustomerId
  }
  if (!workflowId || !files.length) {
    const error = {
      ...HTTP_ERROR_MESSAGES.NOT_FOUND,
      message: 'WorkflowId and at least one file required',
    }
    saveLogs(logs, 400, error, {}, () => {
    });
    return hcb(error)
  }
  auto({
    workflow: (cb) => {
      workflowService.findOne({ _id: workflowId, tenantId }, null, null, null, (err, workflow) => {
        if (err || !workflow) {
          cb({
            statusCode: 400,
            message: 'Workflow not found',
          })
        }
        cb(null, workflow)
      })
    },
    globalMapping: (cb) => {
      if (uploadedDocType === "ANY") {
        return cb()
      }
      globalMappingService.findOne({ documentType: uploadedDocType }, { _id: 1 }, (err, result) => {
        if (err || !result) {
         return cb({
            statusCode: 400,
            message: 'docType not found',
          })
        }
        cb(null, result)
      });
    },
    uploadFiles: ['workflow', 'globalMapping', (_, cb) => {
      const uploadDir = uploadController.createPathDir({ id, tenantId });
      uploadController.upload(files, uploadDir)
        .then((result) => cb(null, result));
    }],
    checkfileSize: ['uploadFiles', ({ uploadFiles }, cb) => {
      if (!uploadFiles[0]) {
        return cb({
          statusCode: 400,
          message: 'you can upload files only',
          ...uploadFiles
        });
      }
      let filSizeInKb = uploadFiles.reduce((accumulator, object) => {
        return accumulator + object.fileSize;
      }, 0);
      filSizeInKb = filSizeInKb && (filSizeInKb / 1000)
      TENANT_SETTINGS.aggregate([{ $match: { tenantId: createMongooseId(tenantId) } }, {
        $lookup: {
          from: 'users',
          localField: 'tenantId',
          foreignField: 'tenantId',
          as: 'user'

        }
      }], (err, result) => {
        const Setting = result[0]

        if (err) {
          cb(err)
        } else {
          if (Setting && Setting.user) {
            const User = Setting.user[0]
            if (User && !User.isTrialAccount) {
              return cb(null, Setting)
            }
            if (filSizeInKb && filSizeInKb / 1000 <= 10) {
              return cb(null, Setting)
            }
            return cb({ statusCode: 403, message: `You can upload 10 mb with single request only` });
          }
          // Setting.storageUsed = Setting.storageUsed && 0
          const dataSize = filSizeInKb + ((Setting && Setting.storageUsed) || 0)
          const limit = ((Setting && Setting.storageLimit) || 25000)
          if (!Setting || dataSize <= limit) {
            return cb(null, Setting)
          }
          return cb({ statusCode: 403, message: `Storage capacity is low, ${limit - dataSize}` })
        }
      })
    }],
    saveDocuments: ['checkfileSize', (results, cb) => {
      _saveDocuments(
        { id, tenantId, uploadedDocType, tableHeaders },
        idpId,
        results.uploadFiles,
        workflowId,
        (err, result) => {
          if (err) {
            return cb(err);
          }
          const { batchId, createBatch: batchDetails } = result;
          const endTime = performance.now();
          return cb(null, {
            batchId,
            documents: batchDetails.documentsToSave,
            idpId: batchDetails.idpId,
            timeUnit: 'milliseconds',
            timeConsumed: parseInt((endTime - startTime).toFixed(2), 10),
          });
        }
      );
    }],
    updateBatch: ['saveDocuments', ({ saveDocuments }, cb) => {
      const dataToSet = { step: 0, uploadedVia: "API" }
      if (externalCustomerId) {
        dataToSet.externalCustomerId = externalCustomerId
      }
      idpService.update({ _id: saveDocuments.idpId }, { $set: dataToSet }, null, cb)
    }],
    updateDocuments: ['saveDocuments', ({ saveDocuments }, cb) => {
      let dataToSet = { uploadedVia: "API" }
      if (externalCustomerId) {
        dataToSet = {
          externalCustomerId,
          ...dataToSet
        }
      }
      documentService.updateAll({ idpId: saveDocuments.idpId }, { $set: dataToSet }, null, cb)
    }],
    saveFileSize: ['saveDocuments', ({ uploadFiles, checkfileSize }, cb) => {
      // if (process.env.NODE_ENV !== 'trial') {
      //   return cb();
      // }
      const filSizeInKb = uploadFiles.reduce((accumulator, object) => {
        return accumulator + object.fileSize;
      }, 0);
      if (!checkfileSize) {
        new TENANT_SETTINGS({ tenantId, storageUsed: filSizeInKb }).save(cb)
      } else {
        TENANT_SETTINGS.findOneAndUpdate({ tenantId }, { $inc: { storageUsed: filSizeInKb } }, cb)
      }
    }]
  }, (err, { workflow, saveDocuments }) => {
    logs.responseTime = true
    if (err) {
      saveLogs(logs, err.code || err.statusCode || 500, err, {}, () => {
        console.log("debug: tenantId: error ", tenantId)
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId });
      });
      return hcb(err)
    }
    if (!workflow) {
      const error = {
        statusCode: 400,
        message: 'Workflow not found',
      }
      saveLogs(logs, 400, error, {}, () => {
        console.log("debug: tenantId: success ", tenantId)
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId });
      });
      return hcb(error);
    }
    const response = { ...HTTP_SUCCESS_MESSAGES.DEFAULT, file_id }
    if (externalCustomerId) {
      response.customerId = externalCustomerId
    }
    response.idpId = saveDocuments.idpId
    hcb(null, response)
    logs.idpId = saveDocuments.idpId
    logs.response = response
    saveLogs(logs, 200, null, {}, () => {
      console.log("debug: tenantId: success 1112", tenantId)
      EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId });
    })
  })
}

const uploadedBatchStatus = ({ tenantId }, { batch_id = null, doc_id = null }, hcb) => {
  const criteria = {
    tenantId,
    "external.batchId": batch_id,
  }
  if (doc_id) {
    criteria['external.docId'] = doc_id
  }
  // console.log('uploadedBatchStatuscriteria',criteria)

  auto({
    documentStatus: (cb) => {
      // console.log("CRITERIA: ", criteria)
      // console.log("CRITERIA par: ", JSON.stringify(criteria))
      // TODO batch level check qc status check
      // documentService.findAll(criteria, docProjection, null, cb);
      // "pageArray.pageNo": 1,
      const projection = { ...docProjection }
      Object.keys(docProjection).forEach(k => {
        if (k.includes("pageArray")) {
          projection[`${k.replace('pageArray', "pages")}`] = 1
        }
      })
      documentService.aggregation([{ $match: criteria },
      {
        $lookup:
        {
          from: 'pages',
          localField: '_id',
          foreignField: 'documentId',
          as: 'pages'
        }
      }, { $project: projection }], cb)
    }
  }, (err, { documentStatus }) => {
    if (err) {
      return hcb(err);
    }
    documentStatus.forEach(doc => {
      if (!doc.isBatchReviewed) { // let's pass original document status only if whole batch is qc completed
        // doc.qcStatus = "PENDING";
        doc.review = "IN_PROGRESS";
      }
      if (doc.pages && doc.pages[0]) {
        doc.pageArray = doc.pages
      }
      delete doc.pages
    })
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: documentStatus });
  })
}

/**
 * APi endpoints list
 * @param {*} param0
 * @param {*} hcb
 */
const listApiEndpoints = ({ id }, { workflowId = null, type = null }, hcb) => {
  auto({
    workflow: (cb) => {
      workflowService.findOne({ _id: createMongooseId(workflowId) }, { workflow: 1 }, null, null, cb)
    },
    idpKey: (cb) => {
      IDPKEY.findOne({ userId: createMongooseId(id) }, cb);
    },
    generateKey: ['idpKey', ({ idpKey }, cb) => {
      // console.log("existing key:", idpKey)
      if (idpKey) {
        return cb();
      }
      idpKeyController.generateApiKey({ id }, (err, res) => {
        // console.log("generated new key:", res)
        cb(null, res && res.data);
      })
    }]
  }, (err, { workflow, idpKey, generateKey }) => {
    if (err) {
      return hcb(err)
    }
    // console.log("idpKey || generateKey", idpKey, generateKey)
    const idpApiKeyDetails = idpKey || generateKey;
    // console.log("workflow", workflow)
    if (!workflow) {
      return hcb({
        ...HTTP_ERROR_MESSAGES.NOT_FOUND,
        message: 'invalid workflow',
      })
    }
    if (!idpApiKeyDetails) {
      return hcb({
        ...HTTP_ERROR_MESSAGES.NOT_FOUND,
        message: 'idp api key not available',
      })
    }
    const API_KEY = idpApiKeyDetails.key
    console.log("REQUEST KEYS")
    const host = process.env.BACKEND_HOST || HOST[process.env.NODE_ENV]
    const curlUploadLineItems = `curl --header 'Content-Type: multipart/form-data' \
    --header 'Authorization: Bearer ${API_KEY}' \
    --form 'workflowId=${workflowId}' \
    --request POST '${host}api/v2/processOcrUpload?customer_id=customer123' \
    --form 'files=@batchid-docid-filename.pdf' \
    --form 'tableHeaders="Customer number"' \
    --form 'tableHeaders="Payment Terms"' \
    --form 'tableHeaders="Line Number"' \
    --form 'tableHeaders="Total Price"' \
    --form 'docType="BOL"'`

    const curlUpload = `curl --header 'Content-Type: multipart/form-data' \
    --header 'Authorization: Bearer ${API_KEY}' \
    --form 'workflowId=${workflowId}' \
    --request POST '${host}api/v2/processOcrUpload?customer_id=customer123' \
    --form 'files=@batchid-docid-filename.pdf' \
    --form 'docType="BOL"'`

    const curlStatus = `curl --header 'Authorization: Bearer ${API_KEY}' \
    --request GET '${host}api/v2/ocrUploadStatus?batch_id=batch123&doc_id=doc123'`
    const curlsObj = {
      "OCR STATUS": curlStatus,
      "OCR UPLOAD": curlUpload,
      "OCR UPLOAD LINE ITEMS": curlUploadLineItems,

    }
    let result = PUBLIC_API_ENDPOINTS.map(e => ({
      ...e,
      workflowId,
      api: `${host}${e.endpoint}`,
      curl: curlsObj[e.type],
      apiKey: API_KEY
    }))
    if (type) {
      result = result.filter(e => e.type === type)
    }

    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: result })
  })
}

/**
 * Document listings for API specific and admin use
 */
const allDocuments = ({ tenantId = null }, query, hcb) => {
  const { limit = 10, offset = 0, status: aiStatus, customerId: externalCustomerId, documentId: externalId, uploadedVia, timeStamp, review: qcStatus, fileReviewed } = query
  const matchQuery = { tenantId }

  if (aiStatus) {
    matchQuery.aiStatus = aiStatus
  }
  if (externalCustomerId) {
    matchQuery.externalCustomerId = externalCustomerId
  }
  if (externalId) {
    matchQuery.externalId = externalId
  }
  if (uploadedVia) {
    matchQuery.uploadedVia = uploadedVia
  }
  if (timeStamp) {
    matchQuery.createdAt = { $gte: new Date(timeStamp) }
  }
  if (qcStatus) {
    matchQuery.qcStatus = qcStatus
    if (qcStatus === "COMPLETED") {
      matchQuery.isFileReviewed = typeof fileReviewed === 'boolean' ? fileReviewed : true;
    }
  }
  auto({
    totalCount: (cb) => {
      documentService.count(matchQuery, cb)
    },
    documents: (cb) => {
      documentService.findAll(matchQuery, docProjection, { offset, limit }, cb)
    }
  }, (e, { documents, totalCount }) => {
    if (e) {
      return hcb(e)
    }
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: documents, totalCount })
  })
}
module.exports = {
  processOcrUpload,
  processOcrInbackground,
  workflowList,
  documentDetails,
  documentList,
  batchList,
  createbatch,
  verifyBatch,
  uploadedBatchStatus,
  saveLogs,
  listApiEndpoints,
  allDocuments
};
