const config = require('config');
const { mapSeries, auto, eachSeries, eachLimit } = require('async');
const { performance } = require('perf_hooks');
const path = require('path');
const fs = require('fs');
const BACKUP_DOCUMENT = require("../Models/backup-document.model")
const { idpService, documentService, workflowService, userService } = require('../Services');
const uploadController = require('./upload.controller');
const {
  createMongooseId,
  calculateProcessedPercentage,
  BoomCustomError
} = require('../Utils/universal-functions.util');
const { reClassifyDocumentsPages } = require('../Utils/document-classification.util')
const { getSingedUrl } = require('../Utils/S3')
const TENANT_SETTINGS = require('../Models/tenant-setting.model');
const { bucketizationDocuments } = require('./document.controller');
const decisionTreeController = require('./decission-tree.controller');
const { verifyDocumentCount } = require('../Utils/ocr.util')
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const BACK_UP = require('../Models/idp-documentlist-backup.model')
const PAGE = require("../Models/page.model")
const PAGE_BACKUP = require('../Models/page-backup.model');
const { updatePages } = require("../Utils/page.util")

const APP_EVENTS = config.get('APP_EVENTS');
const _pathToDownloads = path.join(__dirname, '../../', '/uploads/downloads');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const INDEXER = config.get("ROLES.INDEXER")
const TENANT = config.get("ROLES.TENANT")
const UPLOAD_INPUT_KEY = config.get('UPLOAD_INPUT_KEY');
const AI_STATUS = config.get('AI_STATUS');
const SERVER_ENV = config.get('ENV');
const SERVER_HOST = config.get('HOST');
// save document in series
const saveDoumensInSeries = (documents, idpId) => new Promise((resolve, reject) => {
  mapSeries(documents, (file, cb) => {
    documentService.create(file, (err, result) => {
      if (err) {
        return cb(err);
      }
      return cb(null, result);
    });
  }, (err, savedDocuments) => {
    if (err) {
      return reject(err);
    }
    return resolve({
      batchId: idpId,
      savedDocuments,
    });
  });
});

/**
 * save documents
 * @param {object} userInfo
 * @param {Array} ocrAiMappingArray
 * @param {String} idpId
 */
const _saveDocuments = (
  { id, tenantId = null, externalCustomerId = 140 },
  idpId = null,
  filesArray,
  configId = null,
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
      idpService.countDocuments({ tenantId, isDeleted: false, api: { $nin: [true] } }, (err, result) => {
        if (err) {
          return cb(err);
        }
        idpService.findAll({ tenantId, isDeleted: false, api: { $nin: [true] } }, { name: 1, createdAt: 1 }, { offset: 0, limit: 1 },
          (err, idps) => {
            console.log("err, idps of length", err);
            if (err || !(idps && idps[0])) {
              return cb(null, result + 1);
            }
            const [{ name = null }] = idps;
            console.log(":::::name:::::", name, name && parseInt(name.replace(/\D/ig, ""), 10));
            const count = (name && parseInt(name.replace(/\D/ig, ""), 10)) || result;
            return cb(null, count + 1);
          })
      });
    },
    // create batch
    createBatch: ['batchCount', (results, cb) => {
      if (!idpId) {
        const serialNo = `Batch_${results.batchCount}`;
        const payload = {
          createdBy: id,
          tenantId,
          workflowId: workflowId || configId,
          filesCount: allFiles.length,
          filesUploadedCount: allFiles.length,
          extractedFiles,
          validFiles,
          name: serialNo,
          externalCustomerId
        };
        return idpService.create(payload, (err, result) => {
          if (err) {
            return cb(err);
          }
          const {
            extractedFiles: extractedDataArrays,
            validFiles: validFilesArray, name: batchId, _id, filesCount,
          } = result;
          const mappedDocuments = allFiles.map((file) => ({
            fileOriginalName: file.fileOriginalName,
            fileName: file.fileName,
            fileSize: file.fileSize,
            filePath: file.filePathToSave,
            fileExtension: file.fileExtension,
            external: {
              batchId: (file.fileOriginalName && file.fileOriginalName.split('-')[0]) || 0,
              docId: (file.fileOriginalName && file.fileOriginalName.split('-')[1]) || 0
            },
            externalCustomerId,
            externalId: file.fileOriginalName,
            aiStatus: AI_STATUS.OCR_PENDING,
            idpId: _id,
            configId,
            tenantId,
            createdBy: id,
            mapping: {
              'Document name': file.fileOriginalName,
              'Document size': file.fileSize,
              'Document extension': file.fileExtension,
              'Document type': null,
              'AI status': AI_STATUS.OCR_PENDING,
            },
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
            batch: result
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
      // [TODO]- not required after demo
      if (process.env.NODE_ENV === SERVER_ENV.DEMO) {
        let mappedDocumentsCopy = [...mappedDocuments];
        const fileOrder = [
          'cy58',
          'fibb',
          'mykp',
          'k3td',
          '9176',
        ];
        const priorityDocuments = mappedDocuments.filter(
          (item) => fileOrder.find((order) => new RegExp(order, 'gi').test(item.fileOriginalName)),
        ).flat();
        const fileNames = priorityDocuments.map((item) => item.fileName);
        const unPriorityDocuments = mappedDocuments.filter(
          (item) => fileNames.indexOf(item.fileName) === -1,
        ).flat();
        if (priorityDocuments.length) {
          const file1 = priorityDocuments.find((item) => new RegExp(fileOrder[4], 'gi').test(item.fileOriginalName));
          if (file1) {
            unPriorityDocuments.push(file1);
          }
          const file2 = priorityDocuments.find((item) => new RegExp(fileOrder[3], 'gi').test(item.fileOriginalName));
          if (file1) {
            unPriorityDocuments.push(file2);
          }
          const file3 = priorityDocuments.find((item) => new RegExp(fileOrder[2], 'gi').test(item.fileOriginalName));
          if (file1) {
            unPriorityDocuments.push(file3);
          }
          const file4 = priorityDocuments.find((item) => new RegExp(fileOrder[1], 'gi').test(item.fileOriginalName));
          if (file1) {
            unPriorityDocuments.push(file4);
          }
          const file5 = priorityDocuments.find((item) => new RegExp(fileOrder[0], 'gi').test(item.fileOriginalName));
          if (file1) {
            unPriorityDocuments.push(file5);
          }
          mappedDocumentsCopy = unPriorityDocuments;
        }
        saveDoumensInSeries(mappedDocumentsCopy)
          .then((result) => cb(null, result))
          .catch((err) => cb(err));
      } else {
        documentService.createMany(mappedDocuments, (err, result) => {
          if (err) {
            return cb(err);
          }
          return cb(null, result);
        });
      }
    }],
    batchDetails: ['createBatch', ({ createBatch: { batch = null } }, cb) => {
      if (!batch) {
        cb(null, batch)
      }
      workflowService.findOne({ _id: batch.workflowId }, { workflow: 1 }, null, null, (err, workFlow) => {
        batch.workFlow = workFlow;
        cb(null, { ...JSON.parse(JSON.stringify(batch)), workFlow })
      })
    }]
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results);
  });
};

/**
 * process files
 * @param {Object} userInfo
 * @param {Object} payload
 * @param {Object} params
 * @param {Object} queryParams
 * @returns
 */
const processUpload = (
  { id, tenantId },
  data,
  { id: idpId = null },
  hcb,
) => {
  try {
    const { configId = null, workflowId = null } = data;
    if (configId && workflowId) {
      throw BoomCustomError(400, {
        message: 'Either pass configId or workflowId but not both',
      });
    }
    const startTime = performance.now(); // start uploading
    const files = Array.isArray(data[UPLOAD_INPUT_KEY])
      ? data[UPLOAD_INPUT_KEY] : [data[UPLOAD_INPUT_KEY]];
    auto({
      uploadFiles: (cb) => {
        const uploadDir = uploadController.createPathDir({ id, tenantId });
        uploadController.upload(files, uploadDir)
          .then((result) => {
            if (result && result.message === 'Uploaded files are not valid') {
              return cb({ ...result, statusCode: 400 }, null)
            }
            cb(null, result)
          }).catch(err => cb(err));
      },
      checkfileSize: ['uploadFiles', ({ uploadFiles }, cb) => {
        let filSizeInKb = uploadFiles.reduce((accumulator, object) => {
          return accumulator + object.fileSize;
        }, 0);
        filSizeInKb = filSizeInKb && (filSizeInKb / 1000)
        // filSizeInKb = filSizeInKb && (filSizeInKb / 1000)

        console.log("filSizeInMB", filSizeInKb)

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
              return cb({ statusCode: 403, message: `You can upload 10 mb with single request only` })
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
          { id, tenantId, externalCustomerId: 140 },
          idpId,
          results.uploadFiles,
          configId,
          workflowId,
          (err, result) => {
            if (err) {
              return cb(err);
            }
            const { batchId, batchDetails } = result;
            const endTime = performance.now();
            return cb(null, {
              ...HTTP_SUCCESS_MESSAGES.DEFAULT,
              data: {
                batchId,
                batch: batchDetails,
                timeUnit: 'milliseconds',
                timeConsumed: parseInt((endTime - startTime).toFixed(2), 10),
              },
            });
          },
        );
      }],
      saveFileSize: ['saveDocuments', ({ uploadFiles, checkfileSize }, cb) => {
        let filSizeInKb = uploadFiles.reduce((accumulator, object) => {
          return accumulator + object.fileSize;
        }, 0);
        filSizeInKb = filSizeInKb && (filSizeInKb / 1000)
        if (!checkfileSize) {
          new TENANT_SETTINGS({ tenantId, storageUsed: filSizeInKb }).save(cb)
        } else {
          TENANT_SETTINGS.findOneAndUpdate({ tenantId }, { $inc: { storageUsed: filSizeInKb } }, cb)
        }
      }],
    }, (err, result) => {
      if (err) {
        console.log("upload ERRRRRRRRRRRRRRRR", err)
        return hcb(err);
      }
      return hcb(null, result.saveDocuments);
    });
  } catch (err) {
    console.log("IDP ERRRRRRRRRRRRRRRRRErrr", err);
    hcb({ statusCode: 500, message: "somthing went wrong" });
  }
};

/**
 * fetch documents related to single batch
 * @param {String} idpId
 * @returns - documents wrt batch
 */
const _fetcDocumentsWrtIdp = (idpId, hcb) => {
  const criteria = { isDeleted: false, idpId };
  const projection = {
    status: 1,
    createdAt: 1,
    fileName: 1,
    fileSize: 1,
    filePath: 1,
    idpId: 1,
    pageArray: 1,
    docType: 1,
  };
  documentService.findAll(criteria, projection, (err, result) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, result);
  });
};
const _calculateOcrTime = ({ createdAt = null, tenantId = null }) => new Promise((resolve) => {
  auto({
    count: (cb) => {
      if (!createdAt || !tenantId) {
        return cb(0)
      }
      const query = { aiStatus: 'OCR_PENDING', tenantId: { $nin: [tenantId] }, createdAt: { $lte: createdAt } };
      console.log("COUNT QC QUERY: ", query)
      documentService.count(query, cb)
    }
  }, (err, { count }) => {
    if (err) {
      console.log("ERR _calculateQcTime: ", err)
      return resolve(0);
    }
    return resolve(count);
  })
})
/**
 * document list
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns - fetch all batches
 */
const idpList = (
  { tenantId = null },
  {
    q = '', limit = 0, offset = 0, workflowId = null, fields = null, idpId = null, uploadedVia = "WEBSITE"
  },
  hcb,
) => {
  let projection = {
    name: 1,
    createdAt: 1,
    updatedAt: 1,
    isBatch: 1,
    createdBy: 1,
    filesCount: 1,
    qcCount: 1,
    ocrFailedCount: 1,
    ocrPassedCount: 1,
    timeElapsed: 1,
    identifiedCount: 1,
    nonIdentifiedCount: 1,
    workflowId: 1,
    exportedFromUpload: 1,
    classes: 1,
    modifiedCount: 1,
    feedbackGiven: 1,
    step: 1,
    qcCurrentDocument: 1,
    qcStatus: 1,
    qcThresholdPercent: 1,
    qcRejectedCount: 1,
    qcSampleLimit: 1,
    filesUploadedCount: 1,
    pageRange: 1,
    totalPages: 1
  };
  if (fields) {
    const fieldsArray = fields.split(',');
    if (fields.length) {
      projection = {};
      fieldsArray.forEach((field) => {
        projection[field] = 1;
      });
    }
  }
  let criteria = {
    isDeleted: false,
  };
  if (idpId) {
    criteria._id = createMongooseId(idpId)
  }
  const sortBy = { createdAt: -1 };
  if (tenantId) {
    criteria.tenantId = createMongooseId(tenantId);
  }
  if (workflowId) {
    criteria.workflowId = createMongooseId(workflowId);
  }
  if (q) {
    criteria = {
      ...criteria,
      name: { $regex: q, $options: 'i' },
    };
  }
  if (uploadedVia) {
    if (uploadedVia === "API") {
      criteria = {
        ...criteria,
        $or: [{ api: true }, { uploadedVia }]
      }
    } else {
      criteria.uploadedVia = uploadedVia
    }
  }
  const lookups = [];
  if (!fields || projection.uploadedBy) {
    lookups.push({
      collection: 'users',
      localField: 'createdBy',
      foreignField: '_id',
      outputKey: 'user',
    })
  }
  if (!fields || projection.workFlow) {
    lookups.push({
      collection: 'workflows',
      localField: 'workflowId',
      foreignField: '_id',
      outputKey: 'workflow',
    })
  }
  if (!fields || projection.ocrTime || projection.trainingSetCount || projection.accuracy) {
    lookups.push({
      collection: 'documents',
      localField: '_id',
      foreignField: 'idpId',
      outputKey: 'documents',
    })
  }
  idpService.findAllByAggregation(criteria, projection, lookups, sortBy, offset, limit,
    async (err, result) => {
      if (err) {
        return hcb(err);
      }
      const { dataList, count } = result[0];
      const totalCount = count[0] && count[0].count ? count[0].count : 0;
      let etaOcr;
      if (!fields || projection.etaOcr) {
        etaOcr = await _calculateOcrTime((dataList && dataList[0]) || {})
      }
      const mappedResponse = dataList.map((item) => {
        const {
          user = {}, filesCount, ocrFailedCount: failed = 0,
          ocrPassedCount: passed = 0,
          identifiedCount: identified, nonIdentifiedCount: nonIdentified, workflow: workFlow = {}, documents = [], classes = [], ...data
        } = item;
        let sumConfidenceScore = 0;
        let sumOcrTimeExtract = 0;
        let trainingSetCount = 0;

        if (!fields || projection.ocrTime || projection.trainingSetCount || projection.accuracy) {
          documents.forEach(doc => {
            const cDate = new Date()
            const ocrResponseTimeDif = new Date(doc.ocrResponseTime || cDate) - new Date(doc.ocrRequestTime || cDate)
            sumConfidenceScore += doc.confidenceScore || 0;
            sumOcrTimeExtract += ocrResponseTimeDif || 0;
            const trainingDoc = doc.buckets && doc.buckets.find((obj) => obj.isTaggedAsTrainingDoc);
            trainingSetCount += (trainingDoc ? 1 : 0)
          })
          data.ocrTime = sumOcrTimeExtract;
          data.trainingSetCount = trainingSetCount
          data.accuracy = sumConfidenceScore && sumConfidenceScore / documents.length
        }
        if (!fields || projection.feedbackApplied) {
          const feedbackCount = classes.reduce((accumulator, bucketClass) => {
            return accumulator + (bucketClass.feedbackCount || 0);
          }, 0);
          data.feedbackApplied = feedbackCount;
        }
        if (!fields || projection.etaOcr) {
          data.etaOcr = etaOcr || 0;
        }
        delete data.configId;
        if (!fields || projection.uploadedBy) {
          const [userInfo = {}] = user;
          data.uploadedBy = {
            name: userInfo?.name || null,
          }
        }
        if (!fields || projection.workFlow) {
          const [workFlowInfo = {}] = workFlow
          data.workFlow = {
            _id: workFlowInfo._id,
            name: workFlowInfo.workflow
          }
        }
        if (!fields || projection.processedPercentage) {
          const processedPercentage = calculateProcessedPercentage(failed, passed, filesCount);
          data.processedPercentage = processedPercentage > 100 ? 100 : processedPercentage
        }
        if (!fields || projection.docCount) {
          data.docCount = filesCount
        }

        if (!fields || projection.failed) {
          data.failed = failed
        }
        if (!fields || projection.passed) {
          data.passed = passed
        }
        if (!fields || projection.identified) {
          data.identified = identified
        }
        if (!fields || projection.nonIdentified) {
          data.nonIdentified = nonIdentified
        }
        return data
      });

      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: mappedResponse,
        totalCount,
      });
    });
};

/**
 * document detail
 * @param {Object} userInfo
 * @param {Object} params
 * @returns - fetch single batch details
 */
const idpDetail = ({ tenantId = null }, { id: recordId }, hcb) => {
  const criteria = {
    isDeleted: false,
    _id: recordId,
  };
  const projection = {
    name: 1,
    tenantId: 1,
    createdAt: 1,
    filesCount: 1,
    ocrFailedCount: 1,
    ocrPassedCount: 1,
    identifiedCount: 1,
    nonIdentifiedCount: 1,
    timeElapsed: 1,
    processedPercentage: { $multiply: [{ $divide: [{ $sum: ["$ocrPassedCount", "$ocrFailedCount"] }, "$filesCount"] }, 100] }
  };
  if (tenantId) {
    criteria.tenantId = tenantId;
  }
  idpService.findOne(criteria, projection, { lean: true }, false, async (err, result) => {
    if (err) {
      return hcb(err);
    }
    const etaOcr = await _calculateOcrTime(result || {})
    let response = {};
    if (response) {
      response = {
        ...result,
        etaOcr
      };
    }
    return hcb(
      null,
      {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: response,
      },
    );
  });
};

/**
 * idp delete
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const idpDelete = ({ id, tenantId }, { recordIds }, hcb) => {
  auto({
    deleteDocs: (cb) => {
      const criteria = {
        idpId: {
          $in: recordIds,
        },
      };
      documentService.deleteMany(criteria, cb)
    },
    deleteBatches: ['deleteDocs', (_, cb) => {
      const criteria = {
        _id: {
          $in: recordIds,
        }
      };
      const dataToSet = {
        deletedBy: id,
        step: 6,
        ocrStatus: 'COMPLETED',
        filesUploadedCount: 0,
        filesCount: 0
      }
      EMIT_EVENT('SAVE_LOG', { data: { ...dataToSet, idpId: recordIds[0] }, from: 'DELETE_BATCH_STARTED' });
      idpService.updateAll(criteria, { $set: dataToSet }, {}, cb);
    }]
  }, (e) => {
    EMIT_EVENT('SAVE_LOG', { data: { idpId: recordIds[0], createdBy: id, message: ((e && e.message) || "success") }, from: 'DELETE_BATCH_SUCESS' });
    if (e) {
      return hcb(e)
    }
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "DELETE_BATCH", idpId: recordIds });
    hcb(null, HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS);
  })
};

const batchCreateDownloadLink = (__, { batchId, exportedFromUpload }, hcb) => {
  // [TODO]
  auto({
    generateExcelFile: (cb) => {
      try {
        decisionTreeController.createMapping(null, null, batchId, { source: 'excel' }).then(() => {
          return cb(null, true)
        })
      } catch (err) {
        console.log("ERRR", err);
        cb()
      }
    },
    checkFileExists: ['generateExcelFile', (_, cb) => {
      const fpath = `${_pathToDownloads}/${batchId}.xlsx`;
      fs.access(fpath, fs.F_OK, cb)
    }],
    updateBatch: ['checkFileExists', (_, cb) => {
      if (exportedFromUpload) {
        idpService.update({ _id: batchId }, { $set: { exportedFromUpload } }, { new: false }, cb)
      } else {
        cb(null, true)
      }
    }]

  }, (err) => {
    if (err) {
      // console.log(err,err.code=='ENOENT')
      // err.statusCode=422
      if (err.code === 'ENOENT') {
        return hcb({
          statusCode: 422,
          type: 'NO_BATCH_FOUND',
          message: 'BATCH not found / Batch does not have any ai processed file',
        })
      }
      return hcb(err)
    }
    const host = process.env.BACKEND_HOST || SERVER_HOST[process.env.NODE_ENV] || SERVER_HOST.development
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: `${host}downloads/${batchId}.xlsx`,
    });
  })
};

/**
 * Start ai process
 * @param {*} _
 * @param {*} param1
 * @param {*} hcb
 */
const idpStartAiProcess = (_, { batchId }, hcb) => {
  idpService.update({ _id: batchId }, { $set: { step: 0 } }, {}, (err) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, HTTP_SUCCESS_MESSAGES.DEFAULT);
  });
}
/**
 * Quality check
 * @param {*} _
 * @param {*} param1
 * @param {*} hcb
 */
const qualityCheck = (_, { batchId, qcCurrentDocument, qcStatus, qcThresholdPercent }, hcb) => {
  let dataToSet = {};
  if (qcCurrentDocument) {
    dataToSet.qcCurrentDocument = qcCurrentDocument;
  }
  if (qcThresholdPercent) {
    dataToSet.qcThresholdPercent = qcThresholdPercent;
  }
  auto({
    batch: (cb) => {
      if (qcStatus === 'COMPLETED') {
        return cb(null, null)
      }
      idpService.findOne({ _id: batchId }, null, null, null, cb)
    },
    updateBatch: ['batch', ({ batch = {} }, cb) => {
      if (qcStatus === 'COMPLETED') {
        dataToSet = { qcStatus: 'COMPLETED' }
      } else {
        const totalDocs = batch.identifiedCount;
        dataToSet.qcStatus = 'STARTED'
        if (!batch.qcSampleLimit) {
          dataToSet.qcSampleLimit = (Math.floor((qcThresholdPercent / 100) * totalDocs)) || 1;
        }
      }
      idpService.update({ _id: batchId }, { $set: dataToSet }, { new: true }, cb);
    }],
    bucketize: ['updateBatch', ({ updateBatch }, cb) => {
      if (qcStatus === 'COMPLETED') {
        bucketizationDocuments({ tenantId: updateBatch.tenantId }, { id: batchId }, true, (err, res) => {
          if (err) {
            console.log('IDP CONTROLLLER TRYING TO BUCKETIZE QC CHECKED DOCUMENT');
            return cb(null, false)
          }
          console.log("QC BUCKETING DONE", res)
          return cb(null, true);
        });
      } else {
        return cb(null, null)
      }
    }],
    selectQcSample: ['updateBatch', ({ batch, updateBatch }, cb) => {
      console.log('query for doc list', updateBatch.qcSampleLimit || 100, JSON.stringify({ idpId: batchId, isTableFlag: true, isNonTableFlag: true }))
      if (!batch) {
        return cb(null, []);
      }
      documentService.findAll({ idpId: batchId, isTableFlag: true, isNonTableFlag: true }, { _id: 1 }, { limit: updateBatch.qcSampleLimit || 100 }, cb);
    }],
    updateQcSample: ['selectQcSample', ({ selectQcSample: Documents, batch }, cb) => {
      console.log("GGGGGGGGGGGGGGGGGG", Documents.length)
      let i = 0;
      if (!batch || batch.qcSampleLimit) {
        return cb(null, false);
      }
      eachSeries(Documents, (doc, ecb) => {
        const dataToset = {};
        if (i === 0) {
          dataToset.qcStatus = 'STARTED';
        } else {
          dataToset.qcStatus = 'PENDING'
        }
        i++;
        documentService.update({ _id: doc._id }, { $set: dataToset }, { new: true }, ecb);
      }, cb)
    }],
    updateDocument: ['batch', ({ batch }, cb) => { // api backward compatability
      if (!batch || !batch.qcSampleLimit || !qcCurrentDocument) {
        return cb(null, false);
      }
      documentService.update({ _id: qcCurrentDocument }, { $set: { qcStatus } }, { new: true }, cb);
    }]
  }, (err, { selectQcSample }) => {
    if (err) {
      return hcb(err);
    }
    hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: (selectQcSample && selectQcSample[0]) });
  })
}

const batchDropdownList = ({ tenantId, customers }, { uploadedVia = "API", offset = 0, limit = 10 }, hcb) => {
  const criteria = { tenantId, uploadedVia, filesUploadedCount: { $gt: 0 } }
  const projection = {
    name: 1,
    externalBatchId: 1,
  }
  if (customers) {
    criteria.externalCustomerId = {
      $in: customers
    }
  }
  auto({
    count: (cb) => {
      idpService.countDocuments(criteria, cb)
    },
    idps: (cb) => {
      idpService.findAll(criteria, projection, { offset, limit }, cb)
    }
  }, (err, { idps, count }) => {
    if (err) {
      return hcb(err);
    }
    hcb(null, { totalCount: count, ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: idps });
  })
}

const batchDetails = (_, { idpId }, hcb) => {
  const criteria = { _id: idpId }
  const projection = {
    name: 1,
    createdAt: 1,
    ocrPassedCount: 1,
    identifiedCount: 1,
    nonIdentifiedCount: 1,
    ocrFailedCount: 1,
    filesCount: 1,
    feedbackApplied: {
      $sum: "$classes.feedbackCount"
    },
    feedbackGiven: 1,
    step: 1,
    qcCurrentDocument: 1,
    qcStatus: 1,
    qcThresholdPercent: 1,
    qcRejectedCount: 1,
    qcSampleLimit: 1,
    filesUploadedCount: 1,
    qcCount: 1,
    externalBatchId: 1
  }
  const criteriaDocuments = { idpId: createMongooseId(idpId), aiStatus: { $nin: [AI_STATUS.OCR_FAILED] } }
  auto({
    idpBatch: (cb) => {
      idpService.findOne(criteria, projection, null, null, cb);
    },
    failedFilesCount: (cb) => {
      const pipeLine = [
        { $match: { ...criteriaDocuments, 'aiStatus': AI_STATUS.OCR_FAILED } },
        {
          $group: {
            _id: "$fileName",
            failedDocuments: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
            failedFilesCount: { $sum: 1 },
          }
        }]
      documentService.aggregation(pipeLine, (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0);
        }
        const [{ failedFilesCount = 0 }] = res;
        cb(null, failedFilesCount)
      })
    },
    classificationFilesCompletedCount: (cb) => {
      const pipeLine = [
        { $match: { ...criteriaDocuments, qcStatus: { $nin: ["COMPLETED", "ASSIGNED_SUPERVISOR"] } } },
        {
          $group: {
            _id: "$fileName",
            doc: { $push: { "classification": "$classification" } },
          }
        },
        { $match: { "doc.classification": { $nin: ['STARTED', 'RETRY', 'NOT_REQUIRED'] } } },
        {
          $group: {
            _id: null,
            countFiles: { $sum: 1 }
          }
        }]
      documentService.aggregation(pipeLine, (err, res) => {
        if (err) {
          return cb(err)
        }
        if (!(res && res[0])) {
          return cb(null, 0)
        }
        const [{ countFiles = 0 }] = res;
        cb(null, countFiles)
      })
    },
    documents: (cb) => {
      documentService.aggregation([
        { $match: criteriaDocuments },
        {
          $group: {
            _id: null,
            trainingSetCount: { $sum: { $cond: ["$buckets.isTaggedAsTrainingDoc", 1, 0] } },
            sumConfidenceScore: { $sum: "$confidenceScore" },
            ocrTime: { $sum: { "$subtract": ["$ocrResponseTime", "$ocrRequestTime"] } },
            classificationPendingCount: { $sum: { $cond: [{ $eq: ["$classification", "STARTED"] }, 1, 0] } },
            classificationCompletedCount: { $sum: { $cond: [{ $eq: ["$classification", "COMPLETED"] }, 1, 0] } }
          }
        }], cb)
    },
    qcPendingFilesCount: (cb) => {
      const pipeLine = [
        { $match: { ...criteriaDocuments, aiStatus: { $nin: ["OCR_FAILED"] } } },
        {
          $group: {
            _id: "$fileName",
            doc: {
              $addToSet: {
                qcStatus: "$qcStatus",
                classification: "$classification",
                aiStatus: "$aiStatus"
              }
            },
          }
        },
        {
          $match: { 'doc.qcStatus': "PENDING", "doc.classification": { $in: ['STARTED', 'RETRY', 'NOT_REQUIRED'] } }
        },
        // {
        //   $match: {
        //     $or: [
        //       { "doc.aiStatus": AI_STATUS.OCR_DONE, 'doc.qcStatus': "PENDING", 'doc.classification': "NOT_REQUIRED" },
        //       { "doc.aiStatus": AI_STATUS.OCR_INPROGRESS, 'doc.qcStatus': "PENDING", 'doc.classification': { $in: ["STARTED", "RETRY"] } }
        //     ]
        //   }
        // },
        {
          $group: {
            _id: null,
            qcPendingFiles: { $sum: 1 },
          }
        }]
      documentService.aggregation(pipeLine, (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0);
        }
        const [{ qcPendingFiles = 0 }] = res;
        cb(null, qcPendingFiles)
      })
    },
    reviewFilesCompleted: (cb) => {
      documentService.aggregation([
        { $match: { ...criteriaDocuments, classification: { $in: ['ASSIGNED_SUPERVISOR', 'COMPLETED'] } } },
        {
          $group: {
            _id: "$fileName",
            doc: { $push: { qcStatus: "$qcStatus" } }
          }
        },
        { $match: { "doc.qcStatus": { $nin: ['STARTED', 'PENDING'] } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    },
    allFilesOcrDone: (cb) => {
      const pipeLine = [
        { $match: { ...criteriaDocuments, aiStatus: { $nin: [AI_STATUS.OCR_PENDING, AI_STATUS.OCR_INPROGRESS] } } },
        {
          $group: {
            _id: "$fileName",
          }
        },
        {
          $group: {
            _id: null,
            ocrCompleted: { $sum: 1 },
          }
        }]
      documentService.aggregation(pipeLine, (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0);
        }
        const [{ ocrCompleted = 0 }] = res;
        cb(null, ocrCompleted)
      })
    }
  }, (err, { idpBatch, documents, totalDocuments, qcPendingFilesCount, failedFilesCount, classificationFilesCompletedCount, allFilesOcrDone, reviewFilesCompleted }) => {
    if (err) {
      return hcb(err);
    }
    const filesPassed = (allFilesOcrDone - failedFilesCount) || 0;
    const classificationFilesReviewed = classificationFilesCompletedCount
    const reviewFilesPending = qcPendingFilesCount

    const batchDetails = {
      ...idpBatch,
      ...documents[0],
      totalDocuments,
      qcPendingFilesCount,
      failedFilesCount,
      passedFilesCount: filesPassed,
      reviewFilesPending,
      classificationFilesReviewed,
      reviewFilesCompleted,
      allFilesOcrDoneCount: allFilesOcrDone
      // accuracy: (documents.sumConfidenceScore && documents.sumConfidenceScore) / totalDocuments
    }
    hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: batchDetails });
  })
}

const idpBatchList = ({ tenantId, customers }, { uploadedVia = "API", externalCustomerId = null, q = null, qcStatus = null, sortBy = 'createdAt', orderBy = 'ASC', offset = 0, limit = 10, uploadedDocType }, hcb) => {
  console.log("idb batchlist custmers", customers)
  const criteria = { tenantId, uploadedVia }
  if (externalCustomerId) {
    criteria.externalCustomerId = externalCustomerId
  }
  if (uploadedDocType) {
    criteria.uploadedDocType = uploadedDocType
  }
  if (qcStatus) {
    criteria.qcStatus = qcStatus
    criteria.ocrStatus = 'COMPLETED'
    criteria.filesUploadedCount = { $gt: 0 }
  }
  if (q) {
    criteria['$or'] = [{ externalBatchId: q }, { name: `B${q.substring(1).toLowerCase()}` }, { externalCustomerId: q }]
  }
  if (customers) {
    criteria.externalCustomerId = {
      $in: customers
    }
  }
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  const projection = {
    name: 1,
    createdAt: 1,
    updatedAt: 1,
    timeElapsed: {
      $dateDiff: {
        startDate: "$createdAt",
        endDate: "$ocrResponseTime",
        unit: "millisecond",
      }
    },
    identifiedCount: 1,
    nonIdentifiedCount: 1,
    exportedFromUpload: 1,
    filesUploadedCount: 1,
    filesCount: 1,
    ocrFailedCount: 1,
    ocrPassedCount: 1,
    step: 1,
    externalCustomerId: 1,
    externalBatchId: 1,
    qcStatus: 1,
    uploadedDocType: 1
    // processedPercentage: { $cond: [{ $eq: ["$filesCount", 0] }, 100, { $multiply: [{ $divide: [{ $sum: ["$ocrPassedCount", "$ocrFailedCount"] }, '$filesCount'] }, 100] }] }
  };

  auto({
    count: (cb) => {
      idpService.countDocuments(criteria, cb)
    },
    idps: (cb) => {
      idpService.findAll(criteria, projection, { offset, limit, sort: sortObj }, cb)
    }
  }, (err, { idps = [], count }) => {
    if (err) {
      return hcb(err);
    }
    idps.forEach(e => {
      // e.filesCount = e.filesCount
      e.ocrFilesPendingCount = e.filesCount - ((e.ocrPassedCount + e.ocrFailedCount));
      if (e.ocrFilesPendingCount < 0) {
        e.ocrFilesPendingCount = 0
      }
      e.ocrFilesPassedCount = e.filesUploadedCount - (e.ocrFailedCount + e.ocrFilesPendingCount);
      if (e.ocrFilesPassedCount < 0) {
        e.ocrFilesPassedCount = 0
      }
      e.processedPercentage = ((e.ocrPassedCount + e.ocrFailedCount) / e.filesCount) * 100;
      if (e.step > 0) {
        e.processedPercentage = 100;
      }
    })
    hcb(null, { totalCount: count, ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: idps });
  })
}

const fileListing = (_, { idpId, offset = 0, limit = 20, status = "OCR_SUCCESS", qcStatus, classification, fileName, nextfile, q }, hcb) => {
  // console.log("inside fileListing", _)
  let criteria = { idpId: createMongooseId(idpId) }
  if (status) {
    criteria.aiStatus = status === "OCR_FAILED" ? "OCR_FAILED" : { $nin: ["OCR_FAILED"] };
  }
  if (q) {
    criteria = {
      ...criteria,
      $or: [{ fileOriginalName: q }, { "external.docId": q }]
    }
  }
  const stages = []
  const stagesDocCount = []
  let docMatch = {}
  if (fileName) {
    criteria.fileName = fileName
    if (nextfile) {
      criteria.fileName = { $nin: [fileName] }
      criteria.reviewStartedLockBy = null
      criteria.aiStatus = "OCR_COMPLETE";
      criteria.classification = "NOT_REQUIRED"
    }
  } else {
    if (qcStatus) {
      if (qcStatus === "PENDING") {
        docMatch['doc.qcStatus'] = "PENDING"
      } else {
        docMatch['doc.qcStatus'] = { $nin: ["PENDING"] }
      }
    }
    if (classification) { // todo will return mix if any of the document has classification filter
      if (classification === "PENDING") {
        docMatch['doc.classification'] = { $nin: ['ASSIGNED_SUPERVISOR', 'COMPLETED'] }
      } else if (classification === "COMPLETED") {
        docMatch['doc.classification'] = { $nin: ['STARTED', 'RETRY', 'NOT_REQUIRED'] }
      } else {
        docMatch['doc.classification'] = classification
      }
    } else if (status !== "OCR_FAILED") {
      docMatch = {
        'doc.qcStatus': "PENDING", "doc.classification": { $in: ['STARTED', 'RETRY', 'NOT_REQUIRED'] }
      }
    }
    if (Object.keys(docMatch).length) {
      stages[0] = { $match: docMatch }
      stagesDocCount.push(stages[0])
    }
    stagesDocCount.push({
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    })
    stages.push({ $sort: { _id: 1 } })
    stages.push({ $skip: offset })
    stages.push({ $limit: limit })
  }
  const projection = {
    "fileOriginalName": 1,
    "fileName": 1,
    "filePathToSave": 1,
    "filePath": 1,
    "fileExtension": 1,
    "fileSize": 1,
    "qcStatus": 1,
    "pageArray.pageNo": 1,
    "isQcDone": 1,
    "classification": 1,
    reviewedAt: 1,
    reviewedBy: 1,
    classifiedAt: 1,
    classifiedBy: 1,
    reviewStartedLockBy: 1,
    docTotalPages: 1
  }
  if (_.customers) {
    criteria.externalCustomerId = {
      $in: _.customers
    }
  }
  auto({
    filesCount: (cb) => {
      documentService.aggregation([
        { $match: criteria, },
        {
          $group: {
            _id: "$fileName", doc: { $push: { qcStatus: "$qcStatus", classification: "$classification" } }
          }
        },
        ...stagesDocCount
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    },
    documents: (cb) => {
      // console.log("inside fileListing criteria", JSON.stringify(criteria))
      // console.log("inside fileListing stages", JSON.stringify(stages))
      documentService.aggregation([
        { $match: criteria, },
        { $project: projection },
        {
          $group: {
            _id: "$fileName",
            doc: {
              $push: {
                fileOriginalName: "$fileOriginalName",
                fileName: "$fileName",
                filePathToSave: "$filePathToSave",
                filePath: "$filePath",
                fileExtension: "$fileExtension",
                fileSize: "$fileSize",
                qcStatus: "$qcStatus",
                classification: "$classification",
                reviewedAt: "$reviewedAt",
                reviewedBy: "$reviewedBy",
                classifiedAt: "$classifiedAt",
                classifiedBy: "$classifiedBy",
                reviewStartedLockBy: "$reviewStartedLockBy"
              }
            },
            totalDocument: { $sum: 1 },
            totalPages: { $sum: "$docTotalPages" },
            qcCount: { $sum: { $cond: ["$isQcDone", 1, 0] } },
          }
        },
        ...stages
      ], cb)
    },
    files: ['documents', ({ documents }, cb) => {
      const users = {}
      const files = documents.map(d => {
        let file = { ...d, ...d.doc[0] }
        const doc = file.doc.find(e => e.qcStatus === "PENDING");
        if (doc) {
          file = { ...file, qcStatus: "PENDING" }
        }
        const docClassificationStarted = file.doc.find(e => e.classification === "RETRY" || e.classification === "STARTED");
        if (docClassificationStarted) {
          file = { ...file, classification: docClassificationStarted.classification }
        }
        if (file.reviewedBy) {
          users[file.reviewedBy] = null
        }
        if (file.classifiedBy) {
          users[file.classifiedBy] = null
        }
        delete file.doc;
        delete file._id;
        delete file.pageArray;
        return file
      })
      // console.log("usersid: ", users)
      const userIds = Object.keys(users).filter(e => e && e !== 'undefined').map(e => createMongooseId(e))
      if (!userIds.length) {
        return cb(null, files)
      }
      // console.log("users: ", userIds)
      userService.findAll({ _id: { $in: userIds } }, { email: 1 }, { lean: true }, (err, res) => {
        if (res) {
          res.forEach(u => { users[u._id] = u })
          files.forEach(f => {
            f.reviewedBy = users[f.reviewedBy]
            f.classifiedBy = users[f.classifiedBy]
          })
        }
        cb(null, files)
      });
    }]
  }, (err, { files, filesCount }) => {
    if (err) {
      return hcb(err);
    }
    hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: files, filesCount });
  })
}

const superVisorAssignedFileListing = ({ customers, tenantId, id: userId }, { idpId, uploadedDocType, fileName, batchName, externalCustomerId, externalBatchId, sortBy = 'createdAt', orderBy = 'ASC', offset = 0, limit = 20, q, qcStatus = "ASSIGNED_SUPERVISOR", classification = "ASSIGNED_SUPERVISOR", nextBatch = false, nextFile = false }, hcb) => {
  let criteria = { tenantId: createMongooseId(tenantId), isFileReviewed: true }
  const timeStamp = new Date().getTime() - (1000 * 60 * 60 * 24 * 7)
  let sortObj = {}
  if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
    sortObj[`doc._id`] = orderBy === 'DESC' ? -1 : 1
  } else {
    sortObj = {
      [`doc.${sortBy}`]: orderBy === 'DESC' ? -1 : 1,
    };
  }
  const existField = { $exists: true, $nin: [null] }
  const stages = []
  if (idpId) {
    criteria.idpId = createMongooseId(idpId)
  }
  if (uploadedDocType) {
    criteria.uploadedDocType = uploadedDocType
  }
  if (externalBatchId) {
    criteria["external.batchId"] = externalBatchId
  }
  if (q) {
    criteria = {
      ...criteria,
      $or: [{ fileOriginalName: q }, { "external.docId": q }]
    }
  }
  if (customers && externalCustomerId) {
    const validCustomerId = customers.filter(c => c === externalCustomerId)
    if (!(validCustomerId && validCustomerId[0])) {
      hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: [], filesCount: 0 });
    }
  }
  if (externalCustomerId) {
    criteria["externalCustomerId"] = externalCustomerId
  } else if (customers) {
    criteria.externalCustomerId = {
      $in: customers
    }
  }
  if (fileName) {
    criteria.fileName = fileName
  } else {
    criteria = {
      ...criteria,
      reviewedBy: existField,
      qcStatus,
      classification
    }
    if (qcStatus === "COMPLETED" && classification === "COMPLETED") {
      criteria.classification = "COMPLETED"
      criteria.reviewAcceptedBy = existField
      delete criteria.qcStatus
      stages.push({
        $match: { "doc.qcStatus": { $nin: ['ASSIGNED_SUPERVISOR'] } }
      })
    } else if (classification === "COMPLETED") {
      criteria.classifiedAcceptedBy = existField
      stages.push({
        $match: { "doc.classification": { $nin: ['STARTED', 'RETRY', 'ASSIGNED_SUPERVISOR', 'NOT_REQUIRED', 'FAILED'] } }
      })
      if (nextFile) {
        criteria.reviewStartedLockBy = { $in: [null, createMongooseId(userId)] }
      }
    } else if (classification === "ASSIGNED_SUPERVISOR") {
      if (nextBatch) {
        criteria.reviewStartedLockBy = { $in: [null, createMongooseId(userId)] }
        stages.push({
          $match: { "doc.classification": { $nin: ['STARTED', 'RETRY', 'FAILED'] } }
        })
      } else {
        criteria.classification = { $in: ['STARTED', 'RETRY', 'ASSIGNED_SUPERVISOR'] }
      }
    }
  }

  const projection = {
    _id: 1,
    "fileOriginalName": 1,
    "fileName": 1,
    "filePathToSave": 1,
    "filePath": 1,
    "fileExtension": 1,
    "fileSize": 1,
    "qcStatus": 1,
    "classification": 1,
    "idpId": 1,
    "external": 1,
    "pageArray.pageNo": 1,
    "reviewedAt": 1,
    "reviewedBy": 1,
    "classifiedAcceptedAt": 1,
    "classifiedAcceptedBy": 1,
    "revieweAcceptedAt": 1,
    "reviewAcceptedBy": 1,
    "reviewStartedLockBy": 1,
    "createdAt": 1,
    "externalCustomerId": 1,
    externalBatchId: "$external.batchId",
    uploadedDocType: 1,
    docTotalPages: 1
  }
  let files = []
  const users = {}
  const batches = {};
  const pendingBatches = {}
  // if (nextFile) {
  //   criteria.reviewStartedLockBy = null
  //   stages[0].$match = {
  //     'doc.qcStatus': "PENDING", "doc.classification": { $nin: ['STARTED', 'RETRY', 'NOT_REQUIRED', 'FAILED'] }
  //   }
  // } else if (nextBatch) {
  //   criteria.reviewStartedLockBy = null
  //   criteria.classifiedAcceptedBy = null
  // }
  if (!criteria.idpId && !criteria["external.batchId"]) {
    criteria.createdAt = { $gte: new Date(timeStamp) }
  }
  console.log("criteriaINDEXER ASSIGNED FILES:", criteria);
  auto({
    batch: (cb) => {
      if (!batchName) {
        return cb();
      }
      const batchNumber = batchName.match(/(\d+)/)
      if (!batchNumber) {
        return cb();
      }
      const batch = `Batch_${batchNumber[0]}`;
      idpService.findOne({ tenantId, name: batch }, { _id: 1 }, null, null, (e, r) => {
        if (r) {
          criteria.idpId = createMongooseId(r._id)
          delete criteria.createdAt
        }
        cb()
      })
    },
    filesCount: ['batch', (_, cb) => {
      documentService.aggregation([
        { $match: criteria, },
        {
          $group: {
            _id: "$fileName",
            doc: { $push: { qcStatus: "$qcStatus", } }
          }
        },
        ...stages,
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    }],
    documents: ['batch', (_, cb) => {
      documentService.aggregation([
        { $match: criteria, },
        { $project: projection },
        {
          $group: {
            _id: "$fileName",
            doc: {
              $push: {
                _id: "$_id", // for sort consistancy
                fileOriginalName: "$fileOriginalName",
                fileName: "$fileName",
                filePathToSave: "$filePathToSave",
                filePath: "$filePath",
                fileExtension: "$fileExtension",
                fileSize: "$fileSize",
                qcStatus: "$qcStatus",
                classification: "$classification",
                idpId: "$idpId",
                external: "$external",
                reviewedAt: "$reviewedAt",
                reviewedBy: "$reviewedBy",
                classifiedAcceptedAt: "$classifiedAcceptedAt",
                classifiedAcceptedBy: "$classifiedAcceptedBy",
                revieweAcceptedAt: "$revieweAcceptedAt",
                reviewAcceptedBy: "$reviewAcceptedBy",
                reviewStartedLockBy: "$reviewStartedLockBy",
                createdAt: "$createdAt",
                externalCustomerId: "$externalCustomerId",
                "externalBatchId": "$externalBatchId",
                "uploadedDocType": "$uploadedDocType"
              }
            },
            totalDocument: { $sum: 1 },
            totalPages: { $sum: "$docTotalPages" },
            supQcCount: { $sum: { $cond: ["$reviewAcceptedBy", 1, 0] } }
          }
        },
        ...stages,
        { $sort: sortObj },
        { $skip: offset },
        { $limit: limit }
      ], cb)
    }],
    files: ['documents', ({ documents }, cb) => {
      files = documents.map(d => {
        let file = { ...d, ...d.doc[0] }
        const docClassificationStarted = file.doc.find(e => e.classification === "RETRY" || e.classification === "STARTED");
        if (docClassificationStarted) {
          file = { ...file, classification: docClassificationStarted.classification }
        } else {
          file = { ...file, classification }
        }
        if (file.reviewedBy) {
          users[file.reviewedBy] = null
        }
        if (file.classifiedAcceptedBy) {
          users[file.classifiedAcceptedBy] = null
        }
        if (file.reviewAcceptedBy) {
          users[file.reviewAcceptedBy] = null
        }
        batches[file.idpId] = null
        delete file.doc;
        delete file._id;
        delete file.pageArray;
        return file
      })
      cb()
    }],
    getBatches: ["files", (_, cb) => {
      const idpIds = Object.keys(batches).map(e => createMongooseId(e))
      if (!idpIds.length) {
        return cb()
      }
      idpService.findAll({ _id: { $in: idpIds } }, { name: 1 }, { lean: true }, (err, res) => {
        if (res) {
          res.forEach(b => { batches[b._id] = b.name })
        }
        cb()
      })
    }],
    getPendingBatchFiles: ['files', (_, cb) => {
      const idpIds = Object.keys(batches)
      const limit = idpIds.length
      if (!limit) {
        return cb()
      }
      eachLimit(idpIds, limit, (idpId, elcb) => {
        documentService.findAll({ idpId, $or: [{ aiStatus: { $nin: ['OCR_COMPLETE'] } }, { classification: { $in: ['STARTED', 'RETRY'] } }] }, { _id: 1 }, null, (err, docs) => {
          if (err) {
            return elcb(err)
          }
          if (docs && docs[0]) {
            // disableBatchReview
            pendingBatches[idpId] = true
          } else {
            pendingBatches[idpId] = false
          }
          elcb()
        })
      }, cb)
    }],
    getUsers: ["files", (_, cb) => {
      const userIds = Object.keys(users).filter(e => e && e !== 'undefined').map(e => createMongooseId(e))
      console.log("userIds", userIds)
      if (!userIds.length) {
        return cb()
      }
      userService.findAll({ _id: { $in: userIds } }, { email: 1 }, { lean: true }, (err, res) => {
        if (res) {
          res.forEach(u => { users[u._id] = u })
        }
        cb()
      });
    }],
    assignUserBatch: ['getUsers', 'getBatches', 'getPendingBatchFiles', (_, cb) => {
      files.forEach(f => {
        f.reviewedBy = users[f.reviewedBy]
        f.classifiedAcceptedBy = users[f.classifiedAcceptedBy]
        f.reviewAcceptedBy = users[f.reviewAcceptedBy]
        f.batchName = batches[f.idpId]
        f.disableBatchReview = pendingBatches[f.idpId]
      })
      cb()
    }]
  }, (err, { filesCount }) => {
    if (err) {
      return hcb(err);
    }
    hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: files, filesCount });
  })
}
const superVisorFiles = ({ tenantId, customers }, query, callback) => {
  return callback(null, {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    data: {
      "classificationReviewedCount": 0,
      "reviewPendingCount": 0,
      "reviewCompleted": 0
    }
  })
  const existField = { $exists: true, $nin: [null] }
  const criteria = { tenantId: createMongooseId(tenantId), isFileReviewed: true, reviewedBy: existField }

  if (customers) {
    criteria.externalCustomerId = {
      $in: customers
    }
  }
  auto({
    reviewPendingCount: (cb) => {
      documentService.aggregation([
        { $match: { ...criteria, qcStatus: "ASSIGNED_SUPERVISOR", classification: { $in: ["STARTED", "ASSIGNED_SUPERVISOR", "RETRY"] } } },
        {
          $group: {
            _id: "$fileName"
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    },
    classificationReviewedCount: (cb) => {
      documentService.aggregation([
        { $match: { ...criteria, qcStatus: "ASSIGNED_SUPERVISOR", classifiedAcceptedBy: existField }, },
        {
          $group: {
            _id: "$fileName",
            doc: { $push: { classification: "$classification" } }
          }
        },
        {
          $match: { "doc.classification": { $nin: ['STARTED', 'RETRY', 'ASSIGNED_SUPERVISOR', 'NOT_REQUIRED'] } }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    },
    reviewCompleted: (cb) => {
      documentService.aggregation([
        { $match: { ...criteria, reviewAcceptedBy: existField, classification: "COMPLETED" }, },
        {
          $group: {
            _id: "$fileName",
            doc: { $push: { qcStatus: "$qcStatus" } }
          }
        },
        { $match: { "doc.qcStatus": { $nin: ['ASSIGNED_SUPERVISOR'] } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    },
  }, (err, res) => {
    if (err) {
      return callback(err)
    }
    callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: res });
  })
}
// supervisor screen ends

// Indexer screen starts

const indexerAssignedFileListing = ({ tenantId, customers, id: userId }, { idpId, uploadedDocType, sortBy = 'createdAt', orderBy = 'ASC', offset = 0, limit = 20, status = "OCR_SUCCESS", qcStatus, batchName, externalCustomerId, externalBatchId, classification, fileName, nextBatch = false, nextFile = false, q }, hcb) => {
  const timeStamp = new Date().getTime() - (1000 * 60 * 60 * 24 * 7)
  let criteria = { tenantId: createMongooseId(tenantId), aiStatus: "OCR_COMPLETE" }
  if (status === "OCR_FAILED") {
    criteria.aiStatus = "OCR_FAILED"
  }
  if (uploadedDocType) {
    criteria.uploadedDocType = uploadedDocType
  }
  let sortObj = {}
  if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
    sortObj[`doc.docId`] = orderBy === 'DESC' ? -1 : 1
  } else {
    sortObj = {
      [`doc.${sortBy}`]: orderBy === 'DESC' ? -1 : 1
    };
  }
  if (idpId) {
    criteria.idpId = createMongooseId(idpId)
  }
  if (externalBatchId) {
    criteria["external.batchId"] = externalBatchId
  }

  if (q) {
    criteria = {
      ...criteria,
      $or: [{ fileOriginalName: q }, { "external.docId": q }]
    }
  }
  if (customers && externalCustomerId) {
    const validCustomerId = customers.filter(c => c === externalCustomerId)
    if (!(validCustomerId && validCustomerId[0])) {
      hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: [], filesCount: 0 });
    }
  }

  if (externalCustomerId) {
    criteria["externalCustomerId"] = externalCustomerId
  } else if (customers) {
    criteria.externalCustomerId = {
      $in: customers
    }
  }
  let files = []
  const stages = []
  const stagesDocCount = []
  const users = {}
  const batches = {};
  const pendingBatches = {};
  let docMatch = {}
  if (fileName) {
    criteria = { fileName }
  } else {
    if (qcStatus) {
      if (qcStatus === "PENDING") {
        docMatch['doc.qcStatus'] = "PENDING"
      } else {
        docMatch['doc.qcStatus'] = { $nin: ["PENDING"] }
      }
    }
    if (classification) { // todo will return mix if any of the document has classification filter
      if (classification === "PENDING") {
        docMatch['doc.classification'] = { $nin: ['ASSIGNED_SUPERVISOR', 'COMPLETED'] }
      } else if (classification === "COMPLETED") {
        docMatch['doc.classification'] = { $nin: ['STARTED', 'RETRY', 'NOT_REQUIRED'] }
      } else {
        docMatch['doc.classification'] = classification
      }
    } else if (status !== "OCR_FAILED") {
      docMatch = {
        'doc.qcStatus': "PENDING", "doc.classification": { $in: ['STARTED', 'RETRY', 'NOT_REQUIRED'] }
      }
    }
    if (nextFile) {
      criteria.reviewStartedLockBy = { $in: [null, createMongooseId(userId)] }
      docMatch = {
        'doc.qcStatus': "PENDING", "doc.classification": { $nin: ['STARTED', 'RETRY', 'NOT_REQUIRED', 'FAILED'] }
      }
    } else if (nextBatch) {
      criteria.reviewStartedLockBy = null
      criteria.classifiedBy = null
    }
    if (Object.keys(docMatch).length) {
      stages[0] = { $match: docMatch }
      stagesDocCount.push(stages[0])
    }
    stagesDocCount.push({
      $group: {
        _id: null,
        count: { $sum: 1 }
      }
    })
    stages.push({ $sort: sortObj })
    stages.push({ $skip: offset })
    stages.push({ $limit: limit })
  }
  const projection = {
    _id: 1,
    "fileOriginalName": 1,
    "fileName": 1,
    "filePathToSave": 1,
    "filePath": 1,
    "fileExtension": 1,
    "fileSize": 1,
    "qcStatus": 1,
    "pageArray.pageNo": 1,
    "isQcDone": 1,
    "classification": 1,
    reviewedAt: 1,
    reviewedBy: 1,
    classifiedAt: 1,
    classifiedBy: 1,
    reviewStartedLockBy: 1,
    createdAt: 1,
    idpId: 1,
    externalCustomerId: 1,
    externalBatchId: "$external.batchId",
    reason: 1,
    uploadedDocType: 1,
    docTotalPages: 1
  }
  // console.log("criteriaINDEXER ASSIGNED FILES:", criteria);
  if (Object.keys(criteria).length > 1 && criteria.tenantId && criteria.aiStatus) {
    criteria.createdAt = { $gte: new Date(timeStamp) }
  }
  auto({
    batch: (cb) => {
      if (!batchName) {
        return cb();
      }
      const batchNumber = batchName.match(/(\d+)/)
      if (!batchNumber) {
        return cb();
      }
      const batch = `Batch_${batchNumber[0]}`;
      idpService.findAll({ tenantId, name: batch }, { _id: 1 }, null, (e, r) => {
        if (r) {
          criteria.idpId = { $in: r.map(b => createMongooseId(b._id)) }
          delete criteria.createdAt
        }
        // console.log("batch", r)
        cb()
      })
    },
    filesCount: ['batch', (_, cb) => {
      if (nextBatch) {
        return cb()
      }
      documentService.aggregation([
        { $match: criteria, },
        {
          $group: {
            _id: "$fileName", doc: { $push: { qcStatus: "$qcStatus", classification: "$classification" } }
          }
        },
        ...stagesDocCount
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    }],
    documents: ['batch', (_, cb) => {
      console.log("inside fileListing criteria", criteria)
      // console.log("inside fileListing stages", JSON.stringify(stages))
      documentService.aggregation([
        { $match: criteria, },
        { $project: projection },
        {
          $group: {
            _id: "$fileName",
            doc: {
              $push: {
                docId: "$_id",
                fileOriginalName: "$fileOriginalName",
                fileName: "$fileName",
                filePathToSave: "$filePathToSave",
                filePath: "$filePath",
                fileExtension: "$fileExtension",
                fileSize: "$fileSize",
                qcStatus: "$qcStatus",
                classification: "$classification",
                reviewedAt: "$reviewedAt",
                reviewedBy: "$reviewedBy",
                classifiedAt: "$classifiedAt",
                classifiedBy: "$classifiedBy",
                reviewStartedLockBy: "$reviewStartedLockBy",
                createdAt: "$createdAt",
                idpId: "$idpId",
                externalCustomerId: "$externalCustomerId",
                "externalBatchId": "$externalBatchId",
                reason: "$reason",
                "uploadedDocType": "$uploadedDocType"
              }
            },
            totalDocument: { $sum: 1 },
            totalPages: { $sum: "$docTotalPages" },
            qcCount: { $sum: { $cond: ["$isQcDone", 1, 0] } },
          }
        },
        ...stages
      ], cb)
    }],
    files: ['documents', ({ documents }, cb) => {
      // const users = {}
      files = documents.map(d => {
        let file = { ...d, ...d.doc[0] }
        const doc = file.doc.find(e => e.qcStatus === "PENDING");
        if (doc) {
          file = { ...file, qcStatus: "PENDING" }
        }
        const docClassificationStarted = file.doc.find(e => e.classification === "RETRY" || e.classification === "STARTED");
        if (docClassificationStarted) {
          file = { ...file, classification: docClassificationStarted.classification }
        }
        // console.log("file.reviewedBy", file.reviewedBy);
        if (file.reviewedBy) {
          users[file.reviewedBy] = null
        }
        if (file.classifiedBy) {
          users[file.classifiedBy] = null
        }
        batches[file.idpId] = null
        delete file.doc;
        delete file._id;
        delete file.pageArray;
        return file
      })
      cb()
    }],
    getUsers: ["files", (_, cb) => {
      if (nextBatch) {
        return cb()
      }
      const userIds = Object.keys(users).filter(e => e && e !== 'undefined').map(e => createMongooseId(e))
      console.log("userIds", userIds)
      if (!userIds.length) {
        return cb()
      }
      userService.findAll({ _id: { $in: userIds } }, { email: 1 }, { lean: true }, (err, res) => {
        if (res) {
          res.forEach(u => { users[u._id] = u })
        }
        cb()
      });
    }],
    getPendingBatchFiles: ['files', (_, cb) => {
      if (nextBatch) {
        return cb()
      }
      const idpIds = Object.keys(batches)
      const limit = idpIds.length
      if (!limit) {
        return cb()
      }
      eachLimit(idpIds, limit, (idpId, elcb) => {
        documentService.findAll({ idpId, $or: [{ aiStatus: { $nin: ['OCR_COMPLETE'] } }, { classification: { $in: ['STARTED', 'RETRY'] } }] }, { _id: 1 }, null, (err, docs) => {
          if (err) {
            return elcb(err)
          }
          if (docs && docs[0]) {
            // disableBatchReview
            pendingBatches[idpId] = true
          } else {
            pendingBatches[idpId] = false
          }
          elcb()
        })
      }, cb)
    }],
    getBatches: ["files", (_, cb) => {
      if (nextBatch) {
        return cb()
      }
      const idpIds = Object.keys(batches).map(e => createMongooseId(e))
      if (!idpIds.length) {
        return cb()
      }
      idpService.findAll({ _id: { $in: idpIds } }, { name: 1 }, { lean: true }, (err, res) => {
        if (res) {
          res.forEach(b => { batches[b._id] = b.name })
        }
        cb()
      })
    }],
    assignUserBatch: ['getUsers', 'getBatches', 'getPendingBatchFiles', (_, cb) => {
      if (nextBatch) {
        return cb()
      }
      files.forEach(f => {
        f.reviewedBy = users[f.reviewedBy]
        f.classifiedBy = users[f.classifiedBy]
        f.batchName = batches[f.idpId]
        f.disableBatchReview = pendingBatches[f.idpId]
      })
      cb()
    }]
  }, (err, { filesCount }) => {
    if (err) {
      return hcb(err);
    }
    hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: files, filesCount });
  })
}
/** indexer file screen counts */
const indexerFiles = ({ tenantId, customers }, { idpId, uploadedDocType, queueController = false }, callback) => {
  // const existField = { $exists: true, $nin: [null] }
  // const criteria = { isFileReviewed: true }
  // return callback(null, {
  //   ...HTTP_SUCCESS_MESSAGES.DEFAULT,
  //   data: {
  //     "reviewPendingCount": 0,
  //     "classificationReviewedCount": 0,
  //     "reviewCompleted": 0
  //   }
  // })
  const criteria = { tenantId: createMongooseId(tenantId), aiStatus: AI_STATUS.OCR_DONE }
  if (customers) {
    criteria.externalCustomerId = {
      $in: customers
    }
  }
  if (uploadedDocType) {
    criteria.uploadedDocType = uploadedDocType
  }
  if (idpId) {
    criteria["idpId"] = createMongooseId(idpId)
  }
  const timeStamp = new Date().getTime() - (1000 * 60 * 60 * 24 * 7)
  if (Object.keys(criteria).length === 2 && criteria.tenantId && criteria.aiStatus) {
    criteria.createdAt = { $gte: new Date(timeStamp) }
  }
  auto({
    reviewPendingCount: (cb) => {
      documentService.aggregation([
        { $match: { ...criteria } },
        {
          $group: {
            _id: "$fileName",
            doc: {
              $addToSet: {
                qcStatus: "$qcStatus",
                classification: "$classification",
                aiStatus: "$aiStatus"
              }
            },
          }
        },
        {
          $match: { 'doc.qcStatus': "PENDING", "doc.classification": { $in: ['STARTED', 'RETRY', 'NOT_REQUIRED'] } }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    },
    classificationReviewedCount: (cb) => {
      const pipeLine = [
        { $match: { ...criteria, qcStatus: { $nin: ["COMPLETED", "ASSIGNED_SUPERVISOR"] } } },
        {
          $group: {
            _id: "$fileName",
            doc: { $push: { "classification": "$classification" } },
          }
        },
        { $match: { "doc.classification": { $nin: ['STARTED', 'RETRY', 'NOT_REQUIRED'] } } },
        {
          $group: {
            _id: null,
            countFiles: { $sum: 1 }
          }
        }]
      documentService.aggregation(pipeLine, (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.countFiles || 0)
      })
    },
    reviewCompleted: (cb) => {
      if (queueController) {
        return cb()
      }
      documentService.aggregation([
        { $match: { ...criteria, classification: { $in: ['ASSIGNED_SUPERVISOR', 'COMPLETED'] } } },
        {
          $group: {
            _id: "$fileName",
            doc: { $push: { qcStatus: "$qcStatus" } }
          }
        },
        { $match: { "doc.qcStatus": { $nin: ['STARTED', 'PENDING'] } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ], (err, res) => {
        if (err || !(res && res[0])) {
          return cb(null, 0)
        }
        const result = res && res[0];
        cb(null, result.count || 0)
      })
    },
  }, (err, res) => {
    if (err) {
      return callback(err)
    }
    callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: res });
  })
}

// Indexer screen ends
const pageListing = (user, { idpId, fileName = null }, hcb) => {
  const criteria = { idpId: createMongooseId(idpId) }
  const projection = {
    "pageArray.pageNo": 1,
    "pageArray.pageImageLink": 1,
    "pageArray.s3_thumbnail_path": 1,
    "pageArray.pageId": 1,
    "pageArray.page_type": 1,
    "pageArray.rotateByDegree": 1,
    "pageArray.ocrStrategy": 1,
    "totalPages": 1,
    "docType": 1,
    "qcStatus": 1,
    "docNumber": 1,
    "invoiceNumber": "$mapping.Invoice Number",
    "classification": 1,
    "reviewStartedLockBy": 1,
    "fileName": 1,
    "fileOriginalName": 1,
    "forceSubmitedBy": 1,
    "reviewRole": 1,
    "uploadedDocType": 1
  }
  if (fileName) {
    criteria.fileName = fileName
  }
  if (user.customers) {
    criteria.externalCustomerId = {
      $in: user.customers
    }
  }
  let SCREEN = "INDEX";
  auto({
    checkPage: (cb) => {
      PAGE.findOne({ idpId }, { _id: 1 }, cb)
    },
    pages: ['checkPage', ({ checkPage }, cb) => {
      const stages = [{ $match: criteria }, { $project: projection }]
      if (checkPage) {
        return cb()
      }
      documentService.aggregation([...stages, { $project: projection }, { $unwind: "$pageArray" }, { $sort: { docNumber: 1, "pageArray.pageNo": 1 } }], cb)
    }],
    pagesLatest: ['checkPage', ({ checkPage }, cb) => {
      if (!checkPage) {
        return cb()
      }
      const stages = [
        { $match: { idpId: createMongooseId(idpId) } },
        {
          $lookup:
          {
            from: 'documents',
            localField: 'documentId',
            foreignField: '_id',
            as: 'doc'
          }
        },
        { $replaceRoot: { newRoot: { $mergeObjects: ["$$ROOT", { $arrayElemAt: ["$doc", 0] }, { pageArray: {} }] } } },
        { $match: criteria },
        {
          $project: {
            "pageArray.pageNo": "$pageNo",
            "pageArray.pageImageLink": "$pageImageLink",
            "pageArray.s3_thumbnail_path": "$s3_thumbnail_path",
            "pageArray.pageId": "$pageId",
            "pageArray.page_type": "$page_type",
            "pageArray.rotateByDegree": "$rotateByDegree",
            "pageArray.ocrStrategy": "$ocrStrategy",
            "totalPages": 1,
            "docType": 1,
            "qcStatus": 1,
            "docNumber": 1,
            "invoiceNumber": "$mapping.Invoice Number",
            "classification": 1,
            "reviewStartedLockBy": 1,
            "fileName": 1,
            "fileOriginalName": 1,
            "forceSubmitedBy": 1,
            "reviewRole": 1,
            "uploadedDocType": 1
          }
        },
        { $sort: { docNumber: 1, "pageArray.pageNo": 1 } }
      ]
      PAGE.aggregate(stages, cb)
    }],
    assignSignedUrl: ['pages', 'pagesLatest', ({ pages, pagesLatest, checkPage }, cb) => {
      if (process.env.S3_BUCKET_TYPE === "PUBLIC") {
        return cb()
      }
      let p = pagesLatest
      if (!checkPage) {
        p = pages
      }
      eachLimit(p, 10, (page, ecb) => {
        const image = page.pageArray.pageImageLink
        const thumbnailImage = page.pageArray.s3_thumbnail_path
        if (page.qcStatus === "ASSIGNED_SUPERVISOR") {
          SCREEN = "QC"
        }
        auto({
          image: (acb) => {
            if (!image) {
              return acb()
            }
            getSingedUrl(image, (e, r) => {
              page.pageArray.pageImageLink = !e ? r : image;
              acb()
            })
          },
          thumbnail: (acb) => {
            if (!thumbnailImage) {
              return acb()
            }
            getSingedUrl(thumbnailImage, (e, r) => {
              page.pageArray.s3_thumbnail_path = !e ? r : thumbnailImage;
              acb()
            })
          }
        }, ecb)
      }, cb)
    }]
  }, (err, { pages, pagesLatest }) => {
    if (err) {
      return hcb(err);
    }
    const eventData = {
      role: user.role,
      type: `CLASSIFICATION_STARTED_${SCREEN}`,
      userId: user.id,
      idpId
    }
    if (!fileName) { // to avoid document detail pages list side page view
      EMIT_EVENT("SAVE_USER_ACTION", eventData);
    }
    hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: pages || pagesLatest });
  })
}

const recentRequests = {};
const reClassifyDocumentsFromFile = (user, payload, hcb) => {
  const { idpId, fileName, newClassification = [], qcFromSupervisorScreen = false } = payload
  EMIT_EVENT('SAVE_LOG', { data: payload, from: 'RE_CLASSIFY_FILE_STARTED' });
  console.log("Payload", payload);
  const files = {}
  let responseSent = false
  if (recentRequests.hasOwnProperty(payload.idpId)) {
    return hcb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Key extraction in progress" });
  }
  recentRequests[payload.idpId] = true
  newClassification.forEach(e => {
    if (e.changed) {
      files[e.fileName] = e.fileName
    }
  })
  // map(e => e.fileName)
  auto({
    document: (cb) => {
      const criteria = { idpId }
      if (fileName) {
        criteria.fileName = fileName
      }
      documentService.findOne(criteria, { fileOriginalName: 1 }, null, null, (err, doc) => {
        if (err) {
          return cb(err)
        }
        if (!doc) {
          return cb(HTTP_ERROR_MESSAGES.NO_DOC_FOUND);
        }
        if (doc) {
          payload.fileOriginalName = doc.fileOriginalName
          payload.externalBatchId = doc.fileOriginalName && doc.fileOriginalName.split("-")[0]
        }
        cb()
      })
    },
    preClassificationCheck: (cb) => {
      const criteria = { idpId, classification: { $in: ['STARTED', 'RETRY'] } }
      if (fileName) {
        criteria.fileName = fileName
      }
      documentService.findOne(criteria, { classification: 1, fileOriginalName: 1 }, null, null, (err, doc) => {
        if (err) {
          return cb(err)
        }
        if (doc) {
          return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "key extraction in progress" })
        }
        cb()
      })
    },
    reclassiffy: ["document", "preClassificationCheck", (_, cb) => {
      responseSent = true
      hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { nextfile: null, wait: true } });

      if (newClassification && newClassification.length) {
        reClassifyDocumentsPages({ idpId, fileName, newClassification }, cb);
      } else {
        cb()
      }
    }],
    udpateDoc: ['reclassiffy', (_, cb) => {
      const dataToSet = { reviewStartedLockBy: null, reviewStartedLockAt: null, classification: "COMPLETED" }
      const criteria = { idpId }
      if (Object.keys(files).length) {
        criteria.fileName = { $in: Object.keys(files) }
      }
      if (newClassification && newClassification.length) {
        criteria.classification = "NOT_REQUIRED"
      }
      documentService.updateAll(criteria, { $set: dataToSet }, null, cb)
    }],
    updateFile: ['udpateDoc', (_, cb) => {
      const dataToSet = { qcStatus: "PENDING", reviewStartedLockBy: null, reviewStartedLockAt: null } // isFileReviewed false for reclasify from indexer
      if (qcFromSupervisorScreen) {
        dataToSet.qcStatus = "ASSIGNED_SUPERVISOR"
        dataToSet.classifiedAcceptedBy = user.id
        dataToSet.classifiedAcceptedAt = new Date()
        dataToSet.reviewAcceptedBy = null
        dataToSet.revieweAcceptedAt = null
      } else {
        dataToSet.isFileReviewed = false
        dataToSet.classifiedBy = user.id
        dataToSet.classifiedAt = new Date()
        dataToSet.isQcDone = false
        dataToSet.reviewedBy = null
        dataToSet.reviewedAt = null
        if (user.role !== INDEXER) {
          dataToSet.classifiedAcceptedBy = user.id
          dataToSet.classifiedAcceptedAt = new Date()
        }
      }
      if (user.role === TENANT) {
        dataToSet.forceSubmitedBy = null
      }
      const criteria = { idpId }
      if (Object.keys(files).length) {
        criteria.fileName = { $in: Object.keys(files) } // update on changed files
      } else {
        let qcStatus = []
        if (qcFromSupervisorScreen) {
          qcStatus = ["COMPLETED"]
        } else {
          qcStatus = ["ASSIGNED_SUPERVISOR", "COMPLETED"]
        }
        criteria.qcStatus = { $nin: qcStatus } // update on classified files mostly used on classificatio skip
      }
      console.log("dataToSet::::criteria", dataToSet, criteria)
      documentService.updateAll(criteria, { $set: dataToSet }, null, cb)
    }],
    updateBatch: (cb) => {
      return cb()
      // if (qcFromSupervisorScreen && newClassification && newClassification.length) {
      //   idpService.update({ _id: idpId }, { $set: { qcStatus: "PENDING" } }, null, cb)
      // } else {
      //   cb()
      // }
    },
    nextfile: ['udpateDoc', (_, cb) => {
      return cb()
      // if (!(newClassification && newClassification.length)) {
      // }
      // const query = {
      //   idpId,
      //   offset: 0,
      //   limit: 1,
      //   fileName,
      //   nextfile: true
      // }
      // if (qcFromSupervisorScreen) {
      //   superVisorAssignedFileListing(user, {
      //     ...query
      //   }, (e, response) => {
      //     if (e) {
      //       return e
      //     }
      //     cb(null, response.data && response.data[0])
      //   })
      // } else {
      //   fileListing(user, {
      //     ...query,
      //     qcStatus: "PENDING",
      //     status: "OCR_SUCCESS",
      //     classification: 'PENDING',
      //   }, (e, response) => {
      //     if (e) {
      //       return e
      //     }
      //     cb(null, response.data && response.data[0])
      //   })
      // }
    }]
  }, (err, { nextfile }) => {
    delete recentRequests[payload.idpId] // remove batch id from recent request
    if (err) {
      console.log("ERROR reClassifyDocumentsFromFile: ", err)
      if (!responseSent) {
        return hcb(err);
      }
    }
    const eventData = {
      role: user.role,
      type: `CLASSIFICATION_END_${qcFromSupervisorScreen ? 'QC' : 'INDEX'}`,
      userId: user.id,
      idpId
    }
    EMIT_EVENT("SAVE_USER_ACTION", eventData);
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: user.tenantId, batchId: idpId, eventType: "FILE_STATUS CHANGED", fileName });
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: user.tenantId, eventType: "RELEASE_FILE", data: [{ fileName, idpId }] });
    payload['createdBy'] = `${user.email}(${user.role})`;
    EMIT_EVENT('SAVE_LOG', { data: payload, from: 'RE_CLASSIFY_FILE' });
    if (!responseSent) {
      hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { nextfile } });
    }
  })
}

const deleteFile = ({ id }, { idpId, fileName }, callback) => {
  auto({
    checkFileExists: (cb) => {
      const criteria = { idpId }
      if (fileName) {
        criteria.fileName = fileName
      }
      documentService.findOne({ idpId, fileName }, { _id: 1 }, null, null, (err, doc) => {
        if (!doc) {
          return cb(HTTP_ERROR_MESSAGES.FILE_UPLOAD.FILE_NOT_FOUND);
        }
        cb(err, doc)
      })
    },
    docs: ['checkFileExists', (_, cb) => {
      documentService.findAll({ idpId, fileName }, { _id: 1 }, null, cb)
    }],
    deleteFileDocuments: ['docs', 'checkFileExists', (_, cb) => {
      documentService.deleteMany({ idpId, fileName }, cb)
    }],
    deletePage: ['docs', 'checkFileExists', ({ docs = [] }, cb) => {
      const documents = docs.map(d => d._id)
      PAGE.deleteMany({ idpId, documentId: { $in: documents } }, cb)
    }],
    deleteBackupDocuments: ['deleteFileDocuments', (_, cb) => {
      return cb()
      const documents = []
      BACK_UP.findOne({ idpId }, (e, r) => {
        if (e) {
          return cb(e)
        }
        if (r.documents) {
          r.documents.forEach(d => {
            if (d && d.fileName !== fileName) {
              documents.push(d)
            }
          })
        }
        BACK_UP.findOneAndUpdate({ idpId }, { $set: { documents } }, cb)
      })
    }],
    updateBatch: ['deleteFileDocuments', (_, cb) => {
      idpService.update({ _id: idpId }, { $inc: { filesUploadedCount: -1 } }, null, cb);
    }],
    verifyCount: ['deleteFileDocuments', (_, cb) => verifyDocumentCount(idpId, false, cb)]
  }, (err) => {
    EMIT_EVENT('SAVE_LOG', { data: { idpId, fileName, createdBy: id, message: ((err && err.message) || "success") }, from: 'DELETE_FILE_SUCESS' });
    if (err) {
      return callback(err)
    }
    callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
  })
}

const hardResetBatch = (user, payload, callback) => {
  // step 1 check backup available
  // step 2 delete existing doc
  // step 3 add documents from bacdkup
  console.log("hardResetBatch", JSON.stringify(payload))
  auto({
    checkResetAvailable: (cb) => {
      documentService.findOne({
        idpId: payload.idpId,
        isBatchReviewed: false
      }, { _id: 1 }, null, null, (err, doc) => {
        if (err) {
          return cb(err)
        }
        if (!doc) {
          return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Hard reset not applicable on this batch" })
        }
        cb()
      })
    },
    Pages: (cb) => {
      PAGE_BACKUP.find({ idpId: payload.idpId }).lean().exec(cb)
    },
    fetchBackup: ['checkResetAvailable', (_, cb) => {
      BACK_UP.findOne({ idpId: payload.idpId }, (err, backup) => {
        if (err) {
          return cb(err)
        }
        if (!backup) {
          return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Hard reset not available on this batch" })
        }
        cb(null, backup)
      })
    }],
    deleteFileDocuments: ['fetchBackup', (_, cb) => {
      documentService.deleteMany({ idpId: payload.idpId }, cb)
    }],
    updateBatch: ['fetchBackup', ({ fetchBackup }, cb) => {
      idpService.update({ _id: payload.idpId }, { $set: fetchBackup.batch }, null, cb)
    }],
    createDocuments: ['fetchBackup', 'deleteFileDocuments', ({ fetchBackup }, cb) => {
      documentService.createMany(fetchBackup.documents, cb)
    }],
    restorePages: ["createDocuments", "Pages", ({ Pages }, cb) => {
      console.log("DOC::::::::::::::::::::::::::::::::::::: hardResetBatch")
      if (!(Pages && Pages[0])) {
        return cb()
      }
      updatePages({ idpId: payload.idpId, pageArray: Pages }, cb)
    }],
    removeSavedDocs: ['createDocuments', (_, cb) => {
      BACKUP_DOCUMENT.deleteMany({ "document.idpId": payload.idpId }, cb);
    }]
  }, (err) => {
    if (err) {
      return callback(err)
    }
    const eventData = {
      role: user.role,
      type: `HARD_RESET`,
      userId: user.id,
      idpId: payload.idpId
    }
    EMIT_EVENT("SAVE_USER_ACTION", eventData);
    EMIT_EVENT('SAVE_LOG', { data: payload, from: `DOCUMENT_UPDATE_HARD_RESET` });
    callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT })
  })
}

// TODO
const moveFilesBetweenBatches = (user, { idpId, fileName, newIdpId }, callback) => {
  auto({
    oldBatch: (cb) => {
      idpService.findOne({ _id: idpId }, { _id: 1 }, null, null, cb);
    },
    newBatch: (cb) => {
      idpService.findOne({ _id: newIdpId }, { _id: 1 }, null, null, cb);
    },
    verify: ['oldBatch', 'newBatch', ({ oldBatch, newBatch }, cb) => {
      if (!oldBatch || !newBatch) {
        return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Invalid batch id" })
      }
      // todo verify if file can be moved
      cb()
    }],
    moveFiles: ['verify', (_, cb) => {
      documentService.updateAll({ idpId, fileName }, { $set: { idpId: newIdpId } }, null, (err) => {
        if (err) {
          return cb(err)
        }
        cb()
      })
    }],
    // checkBatch: ['verify', (_, cb) => {
    //   // update batch
    //   cb()
    // }],
    verifyoldBatchCount: ['moveFiles', (_, cb) => {
      verifyDocumentCount(newIdpId, false, cb)
    }],
    verifyNewBatchCount: ['moveFiles', (_, cb) => {
      verifyDocumentCount(idpId, false, cb)
    }]
  }, (err) => {
    if (err) {
      return callback(err)
    }
    callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
  })
}
module.exports = {
  _fetcDocumentsWrtIdp,
  _saveDocuments,
  processUpload,
  idpList,
  idpDetail,
  idpDelete,
  batchCreateDownloadLink,
  idpStartAiProcess,
  qualityCheck,
  idpBatchList, //
  batchDropdownList, //
  batchDetails,
  fileListing, //
  pageListing, //
  reClassifyDocumentsFromFile,
  deleteFile,
  superVisorAssignedFileListing,
  superVisorFiles,
  indexerAssignedFileListing,
  indexerFiles,
  hardResetBatch,
  moveFilesBetweenBatches
};
