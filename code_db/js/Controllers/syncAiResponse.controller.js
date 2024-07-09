/* eslint-disable class-methods-use-this */
const { mapSeries, auto } = require('async');
const config = require('config');
const { idpService, documentService } = require('../Services');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const CONSOLE = require('../Utils/console-log.util');
const { createMongooseId, calculateProcessedPercentage } = require('../Utils/universal-functions.util');

const AI_STATUS = config.get('AI_STATUS');
const APP_EVENTS = config.get('APP_EVENTS');

const syncDocumentsByOcrCB = async (ocrResponse) => {
  const {
    documentId,
    aiUniqueId,
    docType, aiDocType, aiStatus, pageArray, mapping = {},
    confidenceScore,
    ocrTimeExtract,
    isTableFlag = false, isNonTableFlag = false,
    workflowDocs = [],
    corruptFile = false,
    pageRange,
    totalPages,
    s3_link_final_output,
    s3_ocr_path_output
  } = ocrResponse;
  let dataToSet = {
    pageArray,
    aiUniqueId,
    aiStatus,
    confidenceScore,
    isNonTableFlag,
    isTableFlag,
    workflowDocs,
    ocrTimeExtract,
    corruptFile,
    pageRange,
    totalPages,
    s3_link_final_output,
    s3_ocr_path_output,
    aiDocType
  };
  if (mapping && Object.keys(mapping).length) {
    dataToSet = {
      ...dataToSet,
      mapping,
    };
  }
  if (docType) {
    dataToSet = {
      ...dataToSet,
      docType,
    };
  }
  console.log("working in this w documentId", documentId)
  return new Promise((resolve, reject) => {
    documentService.update(
      { _id: documentId },
      {
        $set: dataToSet,
      },
      {},
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      },
    )
  });
};

const __syncBatchBucketsByFeedback = async (
  tenantId,
  batchId = null,
  bucketId = null,
  documentId = null,
  aiStatus,
) => {
  console.log("workingggggg")

  const {
    classes = [], identifiedCount, nonIdentifiedCount, filesCount,
  } = await idpService.findOne({ _id: batchId }) || {};
  const mappedClasses = classes.map((classObj) => {
    if (classObj.bucketId === bucketId) {
      const { buckets = [], feedbackCount = 0, count = 0 } = classObj;
      const updatedBuckets = buckets.map((obj) => {
        let newObj = { ...obj };
        if (obj?.docId?.toString() === documentId?.toString()) {
          newObj = {
            ...newObj,
            isFeedApplied: AI_STATUS.FEEDBACK_DONE === aiStatus,
          };
        }
        return newObj;
      });
      return {
        ...classObj,
        count: (count && AI_STATUS.FEEDBACK_DONE === aiStatus) ? count - 1 : count,
        feedbackCount: (count && AI_STATUS.FEEDBACK_DONE === aiStatus)
          ? feedbackCount + 1 : feedbackCount,
        buckets: updatedBuckets,
      };
    }
    return classObj;
  });
  const updateQuery = { _id: batchId };
  const updatePayload = {
    $set: {
      classes: mappedClasses,
    },
  };
  if (aiStatus && aiStatus === AI_STATUS.FEEDBACK_DONE) {
    updatePayload.$inc = {};
    if (identifiedCount < filesCount) {
      updatePayload.$inc = {
        ...updatePayload.$inc,
        identifiedCount: 1,
      };
    }
    if (nonIdentifiedCount > 0) {
      updatePayload.$inc = {
        ...updatePayload.$inc,
        nonIdentifiedCount: -1,
      };
    }
  }
  await idpService.update(updateQuery, updatePayload);
  console.log("through events", APP_EVENTS.BUCKET)
  return EMIT_EVENT(APP_EVENTS.BUCKET, {
    emitSocket: true,
    socketType: 'BUCKET_BATCH_DOCUMENT',
    tenantId,
    batchId,
  });
};

/**
   * save documents
   * @param {Array} filesMapping
   */
const syncDocumentsByNonTabularFeedbackCB = async (
  payload = [], tenantId = null, batchId = null, bucketId = null,
) => new Promise((resolve, reject) => {
  console.log("dataToSave")
  mapSeries(payload, async (feedbackObj) => {
    const {
      documentId, pageNo, docType, aiStatus, nonTabularContent = null, confidenceScore = 0,
      ocrOutputPath = null, isNonTableFlag = false,
    } = feedbackObj;
    // console.log("batchId && bucketId && documentId && aiStatus === AI_STATUS.FEEDBACK_DONE",batchId && bucketId && documentId && aiStatus === AI_STATUS.FEEDBACK_DONE)
    // console.log("ssss2rrrrrrrr")

    if (batchId && bucketId && documentId && aiStatus === AI_STATUS.FEEDBACK_DONE) {
      try {
        console.log("ssss2rrrrrrrr", aiStatus)
        // this.__syncBatchBucketsByFeedback
        await __syncBatchBucketsByFeedback(
          tenantId, batchId, bucketId, documentId, aiStatus,
        );
        // this.__syncBatchBucketsByFeedback(
        //   tenantId, batchId, bucketId, documentId, aiStatus,
        // ).then(res=>{
        //   console.log("dddssssrrrrrrrr",res)
        // })
      } catch (er) { console.log("rrrrrrrr", er) }
    }
    console.log("ggggggbatchId && bucketId && documentId && aiStatus === AI_STATUS.FEEDBACK_DONE", batchId && bucketId && documentId && aiStatus === AI_STATUS.FEEDBACK_DONE)

    let mappedPageArray = null;
    const { pageArray = [], mapping = {}, buckets = [] } = await documentService
      .findOne({ _id: documentId }) || {};
    const dataToSave = {
      aiStatus,
      isFeedbackApplied: true,
      mapping,
      isNonTableFlag
    };
    mappedPageArray = pageArray && pageArray.map((item) => {
      if (item.pageNo === pageNo) {
        let updatedPage = {
          ...item,
          isFinalized: false,
          isNonTabularFeedbackApplied: true,
        };
        if (ocrOutputPath) {
          updatedPage.ocr_output_path = ocrOutputPath;
        }
        if (nonTabularContent) {
          updatedPage = {
            ...updatedPage,
            nonTabularContent,
          };
          // update mapping
          nonTabularContent.forEach((field) => {
            dataToSave.mapping = {
              ...dataToSave.mapping,
              [field.global_key]: field?.local_value?.text || '',
            };
          });
        }
        return updatedPage;
      }
      return item;
    });
    const mappedBuckets = buckets.map((bucket) => {
      if (bucket.bucketId === bucketId) {
        return {
          ...bucket,
          isFeedbackAppliedOn: aiStatus === AI_STATUS.FEEDBACK_DONE,
        };
      }
      return bucket;
    });
    dataToSave.buckets = mappedBuckets;
    if (mappedPageArray && mappedPageArray.length) {
      dataToSave.pageArray = mappedPageArray;
    }
    if (docType) {
      dataToSave.docType = docType;
      // update mapping
      dataToSave.mapping = {
        'Document type': docType,
        ...dataToSave.mapping,
      };
    }
    if (confidenceScore) {
      dataToSave.confidenceScore = confidenceScore;
    }
    // console.log("dataToSave",dataToSave)
    documentService.update(
      { _id: documentId },
      {
        $set: dataToSave,
      }, (err) => {
        if (err) {
          console.log("sssssserrrrrrrrrrrrrrrrrrrrrrrrrrrr", err);
        }
      }
    );
  }, (err, result) => {
    if (err) {
      console.log("errrrr", err)
      return reject(err);
    }
    return resolve(result);
  });
});

/**
   * save documents
   * @param {Array} filesMapping
   */
const syncDocumentsByTabularFeedbackCB = async (
  payload = [], tenantId = null, batchId = null, bucketId = null,
) => new Promise((resolve) => {
  mapSeries(payload, async (item, cb) => {
    const {
      documentId, pageNo: pageSeq, tabularContent: tabularContentNew = null, aiStatus, docType,
      ocrOutputPath = null, confidenceScore = 0, isTableFlag = false
    } = item;
    // console.log('item>>>',item,'batchId && bucketId && documentId && aiStatus === AI_STATUS.FEEDBACK_DONE',batchId , bucketId , documentId , aiStatus , AI_STATUS.FEEDBACK_DONE)
    if (batchId && bucketId && documentId && aiStatus === AI_STATUS.FEEDBACK_DONE) {
      console.log('sindie 252>>>')
      await __syncBatchBucketsByFeedback(
        tenantId, batchId, bucketId, documentId, aiStatus,
      );
    }
    // console.log('in 255>>>')
    const document = await documentService.findOne({ _id: documentId }) || {};
    // console.log('document',document)
    const { pageArray = [], buckets = [] } = document;
    const mappedBuckets = buckets.map((bucket) => {
      if (bucket.bucketId === bucketId) {
        return {
          ...bucket,
          isFeedbackAppliedOn: aiStatus === AI_STATUS.FEEDBACK_DONE,
        };
      }
      return bucket;
    });
    // console.log('mappedBuckets',mappedBuckets)
    const mappedPageArray = pageArray && pageArray.map((page) => {
      const { pageNo, tabularContent = {} } = page;
      if (pageNo === pageSeq) {
        let updatedPage = {
          ...page,
          isFinalized: false,
          isTabularFeedbackApplied: aiStatus === AI_STATUS.FEEDBACK_DONE,
          aiStatus,
        };
        if (ocrOutputPath) {
          updatedPage.ocr_output_path = ocrOutputPath;
        }
        if (docType) {
          updatedPage = {
            ...updatedPage,
            docType,
          };
        }
        if (tabularContentNew) {
          updatedPage = {
            ...updatedPage,
            tabularContent: {
              ...tabularContent,
              ...tabularContentNew,
            },
          };
        }
        return updatedPage;
      }
      return page;
    });
    // console.log('setting data>>>297',mappedBuckets,'mappedPageArray',mappedPageArray,'aiStatus',aiStatus)
    await documentService.update(
      { _id: documentId },
      {
        $set: {
          buckets: mappedBuckets,
          pageArray: mappedPageArray,
          // [TODO] - will be removed
          aiStatus,
          confidenceScore,
          isTableFlag,
          //  isFeedbackApplied: true,
        },
      },
    );
    cb(null, true);
  }, (err) => {
    if (err) {
      return resolve(true);
    }
    return resolve(true);
  });
});

/**
 * update the files wrt OCR
 * @param {string} idpId
 * @returns
 */
const syncBatchByOcrCB = ({
  idpId, isOCrPassed, isOcrFailed, isIdentified = false,
}, callback) => {
  const criteria = {
    _id: idpId,
  };
  let dataToSet = {};
  const dataToUpdate = {
    updatedAt: new Date(),
  };
  if (isOCrPassed) {
    dataToSet = { ...dataToSet, ocrPassedCount: 1 };
  }
  if (isOcrFailed) {
    dataToSet = {
      ...dataToSet,
      ocrFailedCount: 1,
    };
  }
  if (isIdentified) {
    dataToSet = {
      ...dataToSet,
      identifiedCount: 1,
    };
  }
  if (!isIdentified && isOCrPassed) {
    dataToSet = {
      ...dataToSet,
      nonIdentifiedCount: 1,
    };
  }

  auto({
    updateBatch: (cb) => {
      console.log('criteria', criteria)
      console.log('dataToSet', dataToSet)
      console.log('dataToUpdate', dataToUpdate)
      idpService.update(
        criteria,
        {
          $inc: dataToSet,
          $set: dataToUpdate,
        },
        (err, result) => {
          if (err) {
            return cb(err);
          }
          return cb(null, result);
        },
      );
    },
    calculateTimeElapsed: [
      'updateBatch',
      (results, cb) => {
        const { updateBatch = {} } = results;
        const {
          filesCount,
          ocrFailedCount: failed = 0,
          ocrPassedCount: passed = 0,
        } = updateBatch;
        if (filesCount === (failed + passed + 1)) {
          idpService.calculateTimeElapsed(
            { _id: createMongooseId(idpId) },
            (err, result) => {
              console.log(err, `${idpId} ee have been processed completely`);
              if (err) {
                return cb(err);
              }
              const [timeElapsed] = result;
              idpService.update(
                criteria,
                { $set: { timeElapsed: timeElapsed.dateDiffInSec } },
                null,
                (error, res) => {
                  CONSOLE.info(`${idpId} have been processed completely`);
                  if (error) {
                    return cb(error);
                  }
                  return cb(null, res);
                },
              );
            },
          );
        } else {
          cb(null, results.updateBatch)
        }
      },
    ],
  }, (err, results) => {
    if (err) {
      return callback(err);
    }
    const {
      name,
      createdAt,
      updatedAt,
      timeElapsed,
      identifiedCount,
      nonIdentifiedCount,
      exportedFromUpload,
      filesUploadedCount,
      filesCount,
      ocrFailedCount,
      ocrPassedCount,
      step,
      externalCustomerId,
      externalBatchId,
      qcStatus
    } = results.calculateTimeElapsed;
    const processedPercentage = calculateProcessedPercentage(ocrFailedCount, ocrPassedCount, filesCount) || 0
    callback(null, {
      batchId: idpId,
      name,
      createdAt,
      updatedAt,
      timeElapsed,
      identifiedCount,
      nonIdentifiedCount,
      exportedFromUpload,
      filesUploadedCount,
      filesCount,
      ocrFailedCount,
      ocrPassedCount,
      step,
      externalCustomerId,
      externalBatchId,
      qcStatus,
      processedPercentage: processedPercentage > 100 ? 100 : processedPercentage,
    });
  });
};

module.exports = {
  syncDocumentsByOcrCB,
  syncBatchByOcrCB,
  syncDocumentsByTabularFeedbackCB,
  __syncBatchBucketsByFeedback,
  syncDocumentsByNonTabularFeedbackCB,
};
