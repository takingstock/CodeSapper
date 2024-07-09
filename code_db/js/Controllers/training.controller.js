const config = require('config');
const _ = require('lodash');
const { auto } = require('async');
const { documentService, trainingService, idpService } = require('../Services');
const uploadController = require('./upload.controller')
const { createNewMongooseId, createMongooseId } = require('../Utils/universal-functions.util');
const BATCH_INFO = require('../Models/idp-info.model')

const DB_DOC_TYPE = config.get('DB_DOC_TYPE');
const UPLOAD_INPUT_KEY = config.get('UPLOAD_INPUT_KEY');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const AI_STATUS = config.get('AI_STATUS');

/**
 * save documents
 * @param {object} userInfo
 * @param {Array} ocrAiMappingArray
 * @param {String} idpId
 */
const _saveDocuments = async ({ id, tenantId = null }, filesArray) => {
  const serialNo = `training_${await trainingService.estimatedDocumentCount()}`;
  const validFiles = filesArray
    .filter((item) => !item.folderName)
    .map((item) => item.files)
    .flat();
  const extractedFiles = filesArray.filter((item) => item.folderName);
  const allFiles = filesArray.map((item) => item.files).flat();
  const {
    extractedFiles: extractedDataArrays,
    validFiles: validFilesArray, name: batchId, _id, filesCount,
  } = await trainingService.create({
    name: serialNo,
    createdBy: id,
    tenantId,
    filesCount: allFiles.length,
    filesUploadedCount: allFiles.length,
    extractedFiles,
    validFiles,
  });
  const response = {
    _id, batchId, filesCount, extractedDataArrays, validFilesArray,
  };
  const mappedDocuments = allFiles.map((file) => ({
    opType: DB_DOC_TYPE.TRAINING,
    fileOriginalName: file.fileOriginalName,
    fileName: file.fileName,
    fileSize: file.fileSize,
    filePath: file.filePathToSave,
    fileExtension: file.fileExtension,
    idpId: _id,
    tenantId,
    createdBy: id,
  }));
  await documentService.createMany(mappedDocuments);
  return {
    batchDetails: response,
  };
};

/**
 * fetch documents related to single batch
 * @param {String} idpId
 * @returns - documents wrt batch
 */
const _fetcDocumentsWrtIdp = async (
  idpId,
  opType = DB_DOC_TYPE.TRAINING,
) => documentService.findAll(
  { isDeleted: false, idpId, opType },
  {
    status: 1,
    aiStatus: 1,
    createdAt: 1,
    fileName: 1,
    fileOriginalName: 1,
    fileSize: 1,
    filePath: 1,
    idpId: 1,
    pageArray: 1,
    docType: 1,
  },
);

/**
 * process files
 * @param {Object} userInfo
 * @param {Object} payload
 * @param {Object} params
 * @param {Object} queryParams
 * @returns
 */
const processUpload = async (
  { id, tenantId }, payload,
) => {
  const files = Array.isArray(payload[UPLOAD_INPUT_KEY])
    ? payload[UPLOAD_INPUT_KEY] : [payload[UPLOAD_INPUT_KEY]];
  const filesArray = await uploadController
    .upload(files, uploadController.createPathDir({ id, tenantId }));
  const { batchDetails } = await _saveDocuments({ id, tenantId }, filesArray);
  // console.log("batch",batchDetails)
  const documents = (await _fetcDocumentsWrtIdp(batchDetails._id)).map((item) => ({
    ...item,
    trainingTag: batchDetails.batchId,
  }));
  return {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    data: documents,
  };
};

/**
 * document list
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns - fetch all batches
 */
const trainingList = async ({ tenantId = null }, {
  q = '', limit = 10, offset = 0, sortBy = 'createdAt', orderBy = 'DESC',
}) => {
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  const projection = {
    name: 1, createdAt: 1, isBatch: 1,
  };
  let criteria = {
    isDeleted: false,
  };
  if (tenantId) {
    criteria.tenantId = createMongooseId(tenantId);
  }
  if (q) {
    criteria = {
      ...criteria,
      name: { $regex: q, $options: 'i' },
    };
  }
  const response = await trainingService
    .findAllByAggregation(
      criteria,
      projection,
      [],
      sortObj, offset, limit,
    );
  const { dataList, count } = response[0];
  const totalCount = count[0] && count[0].count ? count[0].count : 0;
  // [TODO] - subject to change as per requirement
  const mappedResponse = await Promise.all(dataList.map(async (item) => {
    const { name, ...data } = item;
    const documents = await _fetcDocumentsWrtIdp(data._id);
    return {
      ...data,
      trainingTag: name,
      documents,
    };
  }));
  return {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    data: mappedResponse,
    totalCount,
  };
};

/**
 * document list
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns - fetch all batches
 */
const trainingDocList = async ({ tenantId = null }, {
  q = '', limit = 10, offset = 0, sortBy = 'createdAt', orderBy = 'DESC',
}) => {
  const projection = {
    opType: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
    fileName: 1,
    fileOriginalName: 1,
    fileSize: 1,
    idpId: 1,
    pageArray: 1,
    docType: 1,
    confidenceScore: 1,
    aiStatus: 1,
  };
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  let criteria = {
    isDeleted: false,
    opType: DB_DOC_TYPE.TRAINING,
  };
  if (tenantId) {
    criteria.tenantId = createMongooseId(tenantId);
  }
  if (q) {
    criteria = {
      ...criteria,
      $or: [
        {
          fileName: { $regex: q, $options: 'i' },
        },
        {

          docType: { $regex: q, $options: 'i' },
        },
      ],
    };
  }
  const lookups = [{
    collection: 'trainings',
    localField: 'idpId',
    foreignField: '_id',
    outputKey: 'trainingData',
  }];
  const response = await documentService
    .findAllByAggregation(
      criteria,
      projection,
      lookups,
      sortObj, offset, limit,
    );
  const { dataList, count } = response[0];
  const totalCount = count[0] && count[0].count ? count[0].count : 0;
  // [TODO] - subject to change as per requirement
  const mappedResponse = dataList.map((item) => {
    const { trainingData = [], ...data } = item;
    const training = (trainingData.length && item.trainingData[0]) || null;
    data.trainingTag = training ? training.name : null;
    data.isBatch = !!training?.filesCount > 1;
    return data;
  });
  return {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    data: mappedResponse,
    totalCount,
  };
};

/**
 * idp delete
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const trainingDelete = async ({ id }, { recordIds }) => {
  const criteria = {
    _id: {
      $in: recordIds,
    },
  };
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
  };
  await trainingService
    .updateAll(criteria, { $set: dataToSet }, {});
  return {
    ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
  };
};

/**
 * idp delete
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const trainingDocDelete = async ({ id }, { recordIds }) => {
  const criteria = {
    _id: {
      $in: recordIds,
    },
  };
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
  };
  await documentService
    .updateAll(criteria, { $set: dataToSet }, {});
  return {
    ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
  };
};

/**
 * retrain
 * @param {Object} payload
 * @param {Object} recordIds - document IDs
 * @returns
 */
const trainingManual = async ({ tenantId }, { recordIds }, hcb) => {
  const criteria = {
    _id: {
      $in: recordIds,
    },
    tenantId,
    aiStatus: AI_STATUS.FEEDBACK_FAILED,
  };

  auto({
    find: (cb) => {
      documentService.findAll(criteria, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    },
    update: ['find', (results, cb) => {
      const mappedIds = results.find.map((item) => item._id);
      documentService
        .updateAll({
          _id: {
            $in: mappedIds,
          },
        },
          {
            $set: {
              aiStatus: AI_STATUS.FEEDBACK_PENDING,
            },
          },
          {},
          (err) => {
            if (err) {
              return cb(err);
            }
            return cb(null, {
              ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            });
          });
    }],
  }, (err, response) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, response.update);
  });
};

/**
 * do ocr again if failed
 * @param {Object} payload
 * @param {Object} recordIds - document IDs
 * @returns
 */
const trainingOcr = async ({ tenantId }, { recordIds }, hcb) => {
  const criteria = {
    _id: {
      $in: recordIds,
    },
    tenantId,
    aiStatus: AI_STATUS.OCR_FAILED,
  };
  auto({
    find: (cb) => {
      documentService.findAll(criteria, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    },
    update: ['find', (results, cb) => {
      const mappedIds = results.find.map((item) => item._id);
      documentService
        .updateAll({
          _id: {
            $in: mappedIds,
          },
        },
          {
            $set: {
              aiStatus: AI_STATUS.FEEDBACK_PENDING,
            },
          },
          {},
          (err) => {
            if (err) {
              return cb(err);
            }
            return cb(null, {
              ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            });
          });
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.update);
  });
};

/**
 * give user-feedbak to AI
 * @param {Object} payload
 * @param {object} "user-feedback"
 * @param {string} "document-category"
 * @param {string} "ocr_link"
 * @param {Array} "global_keys_in_document_caterory"
 * @returns
 */
const trainingNonTabular = ({ id: userId }, { id: documentId }, payload, hcb) => {
  const {
    bucket_id: bucketId = null,
    doc_name: docName = null,
    doc_type: docType = null,
    is_finalized: isFinalized = false,
    page_no: pageNo,
    user_feedback: updatedUserFeedback = [],
    isTablePresent = null
  } = payload;
  if (isFinalized && !bucketId) {
    return hcb({ statusCode: 400, message: "bucketId required" })
  }
  const newUpdatedUserFeedback = updatedUserFeedback.map((item) => {
    if (!item.fieldId) {
      return {
        fieldId: createNewMongooseId(),
        ...item,
      };
    }
    return item;
  });

  auto({
    // get document
    document: (cb) => {
      documentService.findOne({ _id: documentId }, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (!result) {
          return cb(null, {
            data: null,
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          });
        }
        return cb(null, result);
      });
    },
    // update document
    update: ['document', (results, cb) => {
      const { document } = results;
      const { pageArray = [] } = document;
      const mappedPageArray = pageArray.map((page) => {
        if (page.pageNo === pageNo) {
          const { nonTabularContent = [] } = page;
          // [TODO] - will be change as per doc updated
          let merged = _(nonTabularContent) // start sequence
            .keyBy('fieldId') // create a dictionary of the 1st array
            .merge(_.keyBy(newUpdatedUserFeedback, 'fieldId')) // create a dictionary of the 2nd array, and merge it to the 1st
            .values() // turn the combined dictionary to array
            .value(); // get the value (array) out of the sequence
          if (docType && docType !== document.docType) {
            merged = _([]) // start sequence
              .keyBy('fieldId') // create a dictionary of the 1st array
              .merge(_.keyBy(newUpdatedUserFeedback, 'fieldId')) // create a dictionary of the 2nd array, and merge it to the 1st
              .values() // turn the combined dictionary to array
              .value(); // get the value (array) out of the sequence
          }
          return {
            ...page,
            isFinalized: !!isFinalized,
            isNonTabularFeedbackRequested: !!isFinalized,
            nonTabularContent: merged,
          };
        }
        return page;
      });
      const criteria = { _id: documentId };
      const dataToSet = {
        $set: {
          updatedBy: userId,
          pageArray: mappedPageArray,
        },
      };
      if (isFinalized) {
        dataToSet.aiStatus = AI_STATUS.FEEDBACK_PENDING;
      }
      if (docType) {
        dataToSet.docType = docType;
      }
      if (docName) {
        dataToSet.fileName = docName;
      }
      if (bucketId) {
        dataToSet.bucketId = bucketId;
      }
      const projection = {
        opType: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        fileName: 1,
        fileOriginalName: 1,
        fileSize: 1,
        filePath: 1,
        idpId: 1,
        pageArray: 1,
        docType: 1,
        confidenceScore: 1,
        aiStatus: 1,
        buckets: 1,
        api: 1,
        apiBatch: 1,
        tenantId: 1
      };
      documentService.update(
        criteria,
        dataToSet,
        { new: true, projection },
        (err, result) => {
          if (err) {
            return cb(err);
          }
          return cb(null, {
            data: result,
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          });
        },
      );
    }],
    updateBatch: ['update', ({ update }, cb) => {
      // * Update to step 2 >> feedback will be applied on batch
      if (isFinalized) {
        idpService.update({ _id: update.data.idpId }, { $set: { step: 2 }, $inc: { feedbackGiven: 1 } }, (err) => {
          if (err) {
            cb(err)
          } else if (update.api && update.apiBatch !== 'none') {
            BATCH_INFO.findOneAndUpdate({ batchName: update.apiBatch, tenantId: update.tenantId }, { $inc: { feedbackGiven: 1 } }, cb);
          } else {
            cb(null, true)
          }
        });
      } else {
        cb(null, true)
      }
    }],
    checkForTableOnformatChange: ['updateBatch', ({ update }, cb) => {
      if (typeof isTablePresent === 'boolean' && !isTablePresent) {
        documentService.update({ _id: update.data._id }, { $set: { isTableFlag: true } }, cb);
      } else {
        cb(null, true)
      }
    }]
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.update);
  });
};

/**
 * training feedbak - non tabular
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const trainingTabular = ({ id: userId }, { id: documentId }, payload, hcb) => {
  const {
    bucket_id: bucketId = null,
    page_no: pageNo,
    user_feedback: updatedUserFeedback = [],
    is_finalized: isFinalized = false,
    doc_name: docName = null,
    doc_type: docType = null,
    summary = '',
  } = payload;
  if (isFinalized && !bucketId) {
    return hcb({ statusCode: 400, message: "bucketId required" })
  }
  auto({
    // get document
    document: (cb) => {
      documentService.findOne({ _id: documentId }, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (!result) {
          return cb(null, {
            data: null,
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          });
        }
        return cb(null, result);
      });
    },
    // update document
    update: ['document', (results, cb) => {
      const { document } = results;
      // const { document } = results.document;
      // let userFeedbackToSent = {
      //   user_feedback: updatedUserFeedback,
      //   page_no: pageNo,
      //   document_category: documentCategory,
      // };
      const { pageArray = [] } = document;
      const mappedPageArray = pageArray.map((page) => {
        if (page.pageNo === pageNo) {
          // userFeedbackToSent = {
          //   ...userFeedbackToSent,
          //   ocr_link: page.ocr_link,
          // };
          let { tabularContent = {} } = page;
          const logs = tabularContent.logs || [];
          if (summary) {
            logs.push(summary);
          }
          tabularContent = { ...tabularContent, logs, ...updatedUserFeedback };
          if (docType && docType !== document.docType) {
            tabularContent = { logs: [summary], ...updatedUserFeedback };
          }
          return {
            ...page,
            isFinalized,
            isTabularFeedbackRequested: !!isFinalized,
            tabularContent,
          };
        }
        return page;
      });
      const criteria = { _id: documentId };
      const dataToSet = {
        $set: {
          updatedBy: userId,
          pageArray: mappedPageArray,
        },
      };
      if (isFinalized) {
        dataToSet.aiStatus = AI_STATUS.FEEDBACK_PENDING;
      }
      if (bucketId) {
        dataToSet.bucketId = bucketId;
      }
      if (docType) {
        dataToSet.docType = docType;
      }
      if (docName) {
        dataToSet.fileName = docName;
      }

      const projection = {
        opType: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        fileName: 1,
        fileOriginalName: 1,
        fileSize: 1,
        filePath: 1,
        idpId: 1,
        pageArray: 1,
        docType: 1,
        confidenceScore: 1,
        aiStatus: 1,
        buckets: 1,
        api: 1,
        apiBatch: 1,
        tenantId: 1
      };
      documentService.update(
        criteria,
        dataToSet,
        { new: true, projection },
        (err, result) => {
          if (err) {
            return cb(err);
          }
          return cb(null, {
            data: result,
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          });
        },
      );
    }],
    updateBatch: ['update', ({ update }, cb) => {
      // * Update to step 2 >> feedback will be applied on batch
      if (!isFinalized) {
        idpService.update({ _id: update.data.idpId }, { $set: { step: 2 }, $inc: { feedbackGiven: 1 } }, (err) => {
          if (err) {
            cb(err)
          } else if (update.api && update.apiBatch !== 'none') {
            BATCH_INFO.findOneAndUpdate({ batchName: update.apiBatch, tenantId: update.tenantId }, { $inc: { feedbackGiven: 1 } }, cb);
          } else {
            cb(null, true)
          }
        });
      } else {
        cb(null, true)
      }
    }]
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.update);
  });
};

/**
 * training feedback - keys/values
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
/* eslint-disable no-unused-vars */
const trainingDocKeysDelete = async (
  { tenantId }, { recordIds = [] },
  { id: documentId, pageNo },
  hcb,
) => {
  auto({
    document: (cb) => {
      documentService.findOne({ _id: documentId }, (err, document) => {
        if (err) {
          return cb(err);
        }
        if (!document) {
          return cb(null, {
            data: null,
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          });
        }
        return cb(null, document);
      });
    },
    update: ['document', (results, cb) => {
      const { pageArray = [] } = results.document;
      const mappedArray = pageArray.map((item) => {
        if (item.pageNo === pageNo) {
          const { nonTabularContent = [] } = item;
          const filteredContent = nonTabularContent.filter(
            (field) => !recordIds.find((id) => id === field.fieldId.toString()) || null,
          );
          return {
            ...item,
            nonTabularContent: filteredContent,
          };
        }
        return item;
      });
      const projection = {
        opType: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        fileName: 1,
        fileOriginalName: 1,
        fileSize: 1,
        filePath: 1,
        idpId: 1,
        pageArray: 1,
        docType: 1,
        confidenceScore: 1,
        aiStatus: 1,
      };
      const criteria = { _id: documentId };
      const dataToUpdate = {
        $set: {
          pageArray: mappedArray,
        },
      };
      documentService.update(
        criteria,
        dataToUpdate,
        { new: true, projection },
        (err, result) => {
          if (err) {
            return cb(err);
          }
          return cb(null, {
            ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
            data: result,
          });
        },
      );
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.update);
  });
};

const trainingDocDetail = async ({ tenantId = null }, { id: recordId }, hcb) => {
  const criteria = {
    isDeleted: false,
    _id: recordId,
  };
  const projection = {
    opType: 1,
    status: 1,
    createdAt: 1,
    updatedAt: 1,
    fileName: 1,
    fileOriginalName: 1,
    fileSize: 1,
    filePath: 1,
    idpId: 1,
    pageArray: 1,
    docType: 1,
    confidenceScore: 1,
    aiStatus: 1,
  };
  if (tenantId) {
    criteria.tenantId = tenantId;
  }
  let response = await documentService.findOne(criteria, projection, { lean: true });
  if (response) {
    const training = await trainingService.findOne(
      { _id: response.idpId },
      { name: 1 },
      { lean: true },
    );
    response = {
      ...response,
      trainingTag: training?.name || null,
    };
  }
  return hcb(null, {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    data: response,
  })
};

module.exports = {
  processUpload,
  trainingList,
  trainingDocList,
  trainingDocDetail,
  trainingDelete,
  trainingDocDelete,
  trainingManual,
  trainingTabular,
  trainingNonTabular,
  trainingOcr,
  trainingDocKeysDelete,
};
