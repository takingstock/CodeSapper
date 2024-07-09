/* eslint-disable no-unused-vars */
const moment = require('moment');
const { mapSeries, auto, eachLimit, eachSeries } = require('async');
const config = require('config');
const _ = require('lodash');
const axios = require('axios');
const archiver = require('archiver');
const { nanoid } = require('nanoid');

const { documentService, idpService, VendorsService, bolVendorsService } = require('../Services');
const { BoomCustomError, createMongooseId } = require('../Utils/universal-functions.util');
const uploadController = require('./upload.controller');
const docOutputController = require('./doc-output.controller');
const AI_ENDPOINTS = require('../Utils/ai-endpoints.util');
const sharedMongodb = require('../Utils/sharedMongodb.util')
const { _customizeBucketResoonse, _updateFlagsForDocs } = require('../Helpers/bucket');
const { vendorAiUpdate } = require('./vendor-ai-controller');
const { getSingedUrl } = require('../Utils/S3');
const { fileSendToSupervisor, checkFileReviewed } = require('../Utils/document-classification.util');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const { updateCellInfo, fetchCellInfo } = require("./cell-info-metaData.contorller");
const PAGE = require('../Models/page.model');
const { updatePages } = require("../Utils/page.util");
const BACKUP_DOCUMENT = require("../Models/backup-document.model")

const IMC = config.get('IMC');
const INDEXER = config.get("ROLES.INDEXER")
const APP_EVENTS = config.get('APP_EVENTS');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const DB_DOC_TYPE = config.get('DB_DOC_TYPE');
const OUTPUT_EXTENSIONS = config.get('OUTPUT_EXTENSIONS');
const AI_STATUS = config.get('AI_STATUS')
const _documentProjection = {
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
  isTableFlag: 1,
  isNonTableFlag: 1,
  isTaggedAsTrainingDoc: 1,
  buckets: 1,
  workflowDocs: 1,
  ocrTimeExtract: 1,
  isQcDone: 1,
  qcStatus: 1,
  pushToRejected: 1,
  pageRange: 1,
  totalPages: 1,
  aiUniqueId: 1,
  externalCustomerId: 1,
  addressId: 1,
  flagVendorExists: 1,
  uploadedDocType: 1,
  table_columns: 1,
  header_table: 1,
  external: 1,
  table_datatypes: 1,
  table_thresholds: 1,
  flag_3_5: 1,
  feedback_column_dict: 1,
};

/**
 * document list
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns
 */
const documentList = ({ tenantId = null }, {
  q = '', limit = 10, offset = 0, isAssigned = false, sortBy = 'createdAt', orderBy = 'DESC', status = null,
  score = null, configId = null, batchId = null, isIdentified = null, bucketId = null,
  isFeedbackApplied = null, isNonIdentified = false, corruptFiles = false, trainingSet = false
}, hcb) => {
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
    fileOriginalName: orderBy === 'DESC' ? 1 : -1,
    "_id": 1, // tie breaker
  };
  auto({
    batchDetails: (cb) => {
      idpService.findOne({ _id: batchId }, cb);
    },
    bucketization: ['batchDetails', ({ batchDetails }, cb) => { // bucketization depends on qc complete status
      if (typeof isFeedbackApplied === 'boolean' && !isFeedbackApplied && (batchDetails.qcStatus === 'COMPLETED' || batchDetails.identifiedCount <= 0)) {
        /* eslint-disable no-use-before-define */
        bucketizationDocuments({ tenantId }, { id: batchId }, false, (err) => {
          if (err) {
            return cb({ statusCode: 500, message: 'Bucketing ai server is down try again later' })
          }
          cb(null, true);
        })
      } else {
        cb(null, true);
      }
    }],
    listDocument: ['bucketization', 'batchDetails', ({ batchDetails }, cb) => {
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
      if (typeof isFeedbackApplied === 'boolean') {
        if (isFeedbackApplied) {
          criteria = {
            ...criteria,
            buckets: {
              $elemMatch: {
                isFeedbackAppliedOn: true,
              },
            },
          };
        } else if (batchDetails.qcStatus === 'COMPLETED' || batchDetails.identifiedCount <= 0) {
          criteria = {
            ...criteria,
            buckets: {
              $elemMatch: {
                isFeedbackAppliedOn: false,
                isTaggedAsTrainingDoc: false
              },
            },
          }
        } else {
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
        }
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
                {
                  'buckets.bucketCategory': { $regex: q, $options: 'i' }
                }
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
      if (batchId) {
        criteria = {
          ...criteria,
          idpId: createMongooseId(batchId),
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
        };
      }
      if (trainingSet) {
        criteria = {
          ...criteria,
          buckets: {
            $elemMatch: {
              isTaggedAsTrainingDoc: true
            },
          },
        };
      }
      const lookups = [{
        collection: 'idps',
        localField: 'idpId',
        foreignField: '_id',
        outputKey: 'idpData',
      }];
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
      documentService
        .findAllByAggregation(
          criteria,
          { ..._documentProjection, bucketId: 1, buckets: 1 },
          lookups,
          sortObj, offset, limit,
          null,
          (err, result) => {
            if (err) {
              return cb(err);
            }
            const { dataList, count } = result[0];
            const totalCount = count[0] && count[0].count ? count[0].count : 0;
            // [TODO] - subject to change as per requirement
            const mappedResponse = dataList.map((item) => {
              const { idpData = [], buckets = [], ...data } = item;
              const trainingDoc = buckets.find((obj) => obj.isTaggedAsTrainingDoc);
              data.isTrainingDoc = !!trainingDoc;
              data.sectionName = data.bucketCategory || null;
              const idp = (idpData.length && item.idpData[0]) || null;
              data.serailNo = idp && idp.name;
              data.isBatch = idp && idp.filesCount > 1;
              data.buckets = buckets
              return data;
            });
            cb(null, {
              ...HTTP_SUCCESS_MESSAGES.DEFAULT,
              data: mappedResponse,
              totalCount,
            });
          },
        );
    }]
  }, (err, res) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, res.listDocument);
  })
};

/**
 * document list
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns
 */
const documentListIMC = (_, {
  sortBy = 'createdAt', orderBy = 'DESC', tenantId, batchId = null, allFields = false
}, hcb) => {
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
    fileOriginalName: orderBy === 'DESC' ? 1 : -1
  };
  const criteria = {
    isDeleted: false,
    opType: DB_DOC_TYPE.PROCESSING,
    idpId: batchId,
  };
  if (tenantId) {
    criteria.tenantId = createMongooseId(tenantId);
  }
  let projection = null;
  if (!allFields) {
    projection = { mapping: 1 }
  }
  documentService.findAll(criteria, projection, sortObj, (err, result) => {
    if (err) {
      return hcb(err);
    }
    const mappedDocs = allFields ? result : result.map((item) => item.mapping).flat();
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: mappedDocs,
    });
  });
};

/**
 * document detail
 * @param {Object} userInfo
 * @param {Object} params
 * @returns
 */
const documentDetail = ({ tenantId = null, role, id: userId }, { id: recordId }, { qcFromSupervisorScreen = false }, hcb) => {
  const criteria = {
    isDeleted: false,
    _id: recordId,
  };
  if (tenantId) {
    criteria.tenantId = tenantId;
  }
  const option = {
    lean: true,
  };
  const populateArray = [{
    path: 'idpId',
    fields: 'name filesCount',
  }];
  let batchTotalPages = 0
  auto({
    checkDocument: (cb) => {
      documentService.findOne(
        criteria, _documentProjection, option, populateArray,
        (err, result) => {
          if (err) {
            return cb(err);
          }
          if (!result) {
            return cb(HTTP_ERROR_MESSAGES.NO_DOC_FOUND);
          }
          return cb(null, result);
        },
      );
    },
    Pages: (cb) => {
      PAGE.find({ documentId: recordId }).sort({ pageNo: 1 }).lean().exec(cb)
    },
    document: ['checkDocument', 'Pages', ({ checkDocument: document, Pages }, cb) => {
      if (Pages && Pages[0]) {
        document.pageArray = Pages
      }
      return cb(null, document)
      let match = {
        idpId: createMongooseId(document.idpId._id),
        isDeleted: false,
      }
      if (document.isFeedbackApplied) {
        match.isFeedbackApplied = document.isFeedbackApplied
      }
      if (document.isTableFlag && document.isNonTableFlag) {
        match = {
          ...match,
          isTableFlag: true,
          isNonTableFlag: true,
        }
      } else {
        match['$or'] = [
          {
            isTableFlag: false,
          },
          {
            isNonTableFlag: false,
          },
        ]
      }
      const facet = {
        $facet:
        {
          nextDoc: [{ $match: { ...match, fileOriginalName: { $lt: document.fileOriginalName } } }, { $project: { _id: 1, fileOriginalName: 1 } }, { $sort: { fileOriginalName: -1, "_id": 1 } }, { $limit: 1 }],
          previous: [{ $match: { ...match, fileOriginalName: { $gt: document.fileOriginalName } } }, { $project: { _id: 1, fileOriginalName: 1 } }, { $sort: { fileOriginalName: 1, "_id": 1 } }, { $limit: 1 }],
        }
      }
      // console.log("QUERY", JSON.stringify([facet]));
      documentService.aggregation([facet], (err, res) => {
        console.log(err, res)
        if (err) {
          return cb(err)
        }
        const [docs] = res
        document.preDocId = (docs.previous[0] && docs.previous[0]._id) || null;
        document.nextDocId = (docs.nextDoc[0] && docs.nextDoc[0]._id) || null;
        cb(null, document)
      })
    }],
    workflowDocs: ['document', (results, cb) => {
      return cb()
      const { document } = results;
      if (!document.hasOwnProperty('workflowDocs')) {
        return cb(null, null);
      }
      mapSeries(document.workflowDocs, (link, mscb) => documentService.findOne(
        {
          idpId: document.idpId,
          'pageArray.pageImageLink': new RegExp(link, 'gi'),
        },
        {},
        {},
        null,
        (err, workflowDoc) => {
          if (!workflowDoc) {
            return mscb(null, null);
          }
          return mscb(null, {
            docId: workflowDoc._id,
            docType: workflowDoc.docType,
            pageImageLink: workflowDoc.pageArray.length
              ? workflowDoc.pageArray[0].pageImageLink : null,
          });
        },
      ), (err, savedDocuments) => {
        if (err) {
          return cb(err);
        }
        return cb(null, savedDocuments);
      });
    }],
    batchFilesCount: ['checkDocument', 'Pages', ({ checkDocument, Pages }, cb) => {
      const stages = [{ $match: { idpId: createMongooseId(checkDocument.idpId._id), aiStatus: AI_STATUS.OCR_DONE } }]
      if (Pages && Pages[0]) {
        stages.push({
          $lookup: {
            from: "pages",
            localField: "_id",
            foreignField: "documentId",
            as: "pageArray"
          }
        })
      }
      documentService.aggregation([
        ...stages,
        {
          $group: {
            _id: "$fileName",
            totalPages: { $sum: { $size: { "$ifNull": ["$pageArray", []] } } },
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            batchTotalPages: { $sum: "$totalPages" }
          }
        }], (err, res) => {
          if (err || !(res && res[0])) {
            return cb(null, 0)
          }
          const result = res && res[0];
          batchTotalPages = result.batchTotalPages
          cb(null, result.count || 0)
        })
    }],
    batchFilesReviewPendingCount: ['checkDocument', ({ checkDocument, Pages }, cb) => {
      let matchQuery = { idpId: createMongooseId(checkDocument.idpId._id), aiStatus: AI_STATUS.OCR_DONE }
      if (qcFromSupervisorScreen) {
        matchQuery = { ...matchQuery, qcStatus: "ASSIGNED_SUPERVISOR" }
      } else {
        matchQuery = { ...matchQuery, qcStatus: "PENDING" }
      }
      const stages = [{ $match: matchQuery }]
      if (!(Pages && Pages[0])) {
        stages.push({
          $lookup: {
            from: "pages",
            localField: "_id",
            foreignField: "documentId",
            as: "pageArray"
          }
        })
      }
      documentService.aggregation([
        ...stages,
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
        }], (err, res) => {
          if (err || !(res && res[0])) {
            return cb(null, 0)
          }
          const result = res && res[0];
          cb(null, result.count || 0)
        });
    }],
    assignSignedUrl: ['workflowDocs', 'checkDocument', ({ checkDocument }, cb) => {
      eachLimit(checkDocument.pageArray, 10, (page, ecb) => {
        const image = page.pageImageLink
        if (image) {
          auto({
            url: (acb) => {
              if (process.env.S3_BUCKET_TYPE === "PUBLIC") {
                return acb()
              }
              getSingedUrl(image, (e, r) => {
                page.pageImageLink = !e ? r : image
                acb()
              })
            },
            cellInfoMetaData: (acb) => {
              if (page.tabularContent && page.tabularContent[0]) {
                fetchCellInfo({}, { pageId: page.pageId }, (e, data) => {
                  if (data && data[0] && data[0].cell_info_metadata) {
                    page.tabularContent[0].cell_info_metadata = data[0].cell_info_metadata
                  }
                  acb()
                })
              } else {
                acb()
              }
            }
          }, ecb)
        } else {
          ecb()
        }
      }, cb)
    }]
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    if (results) {
      const { idpId = {}, ...data } = results.document;
      const eventData = {
        role,
        type: `${qcFromSupervisorScreen ? "QC" : "REVIEW"}_STARTED`,
        userId,
        idpId,
        fileOriginalName: data && data.fileOriginalName,
        documentId: data && data._id
      }
      EMIT_EVENT("SAVE_USER_ACTION", eventData);
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: {
          idpId: idpId?._id || null,
          serialNo: idpId?.name || null,
          isBatch: !!idpId?.filesCount > 1,
          ...data,
          workflowDocs: results.workflowDocs,
          batchFilesCount: results.batchFilesCount,
          batchFilesReviewPendingCount: results.batchFilesReviewPendingCount,
          batchTotalPages,
        },
      });
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: null,
    });
  });
};

/**
 * document update
 * @param {Object} userInfo
 * @param {Object} params
 * @param {Object} payload
 * @returns
 */
const documentUpdate = async ({ id: userId, role, tenantId, email }, { id: documentId }, payload, hcb) => {
  const {
    fieldArray = [], isFinalized = false, pageId, docType = null, status, reason = '', qcFromSupervisorScreen = false, tables = [], header_table
  } = payload;
  const tableFlagChanged = false;
  const nonTableFlagChanged = false;
  let flagVendorExistsChangedToTrue = false;
  let ocrOutputLink
  const tabularContentObj = {}
  let edited_value = false
  // const tabularContentCellInfoMetaObj = {}
  tables.forEach((td) => {
    // tabularContentCellInfoMetaObj[td.pageId] = td.tabularContent.map(c => c.cell_info_metadata)
    tabularContentObj[td.pageId] = td.tabularContent.map(c => {
      const d = c
      // d.cell_info_metadata = [];// make it default to empty for page Array
      return c
    })
  })
  let updatedPages = null
  // console.log("tabular content payload", JSON.stringify(tabularContentObj))
  // console.log("tabular cell info meta data content payload", JSON.stringify(tabularContentCellInfoMetaObj))
  auto({
    document: (cb) => {
      documentService.findOne({ _id: documentId }, {}, {}, null, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (!result) {
          return cb(HTTP_ERROR_MESSAGES.NO_DOC_FOUND);
        }
        return cb(null, result);
      });
    },
    Pages: (cb) => {
      PAGE.find({ documentId }).lean().exec(cb)
    },
    checkVendorChange: ['document', ({ document }, cb) => {
      if (!document.flagVendorExists && document.docType !== "#NEW_FORMAT#") {
        console.log("checkVendorChange inside")
        const changedKeys = {}
        let vendorChanged = false
        const changedVendorValues = {}
        fieldArray.forEach(e => {
          changedKeys[e.fieldId] = e.fieldValue
          if (e.global_key === 'Vendor ID' || e.global_key === 'Vendor Name' || e.global_key === 'Vendor Address') {
            changedVendorValues[e.global_key] = e.fieldValue
            vendorChanged = true
            flagVendorExistsChangedToTrue = true;
          }
        })
        let query
        if (vendorChanged) {
          query = {
            vendorId: changedVendorValues['Vendor ID'],
            vendorName: changedVendorValues['Vendor Name'],
            vendorAddress: changedVendorValues['Vendor Address']
          }
        }
        console.log("checkVendorChange query", query)
        if (query) {
          auto({
            vendor: (acb) => {
              VendorsService.findOne(query, null, null, acb);
            },
            bolVendor: (acb) => {
              bolVendorsService.findOne(query, null, null, acb);
            }
          }, (e, { vendor, bolVendor }) => {
            if (e) {
              return cb(e);
            }
            if (vendor || bolVendor) {
              return cb()
            }
            cb({ ...HTTP_ERROR_MESSAGES.FORBIDDEN, message: "Vendor not found in vendor list vendor change required" })
          })
        } else {
          return cb()
        }
      } else {
        return cb()
      }
    }],
    checkFileLockedByUser: ['checkVendorChange', ({ document }, cb) => {
      console.log("document.reviewStartedLockBy === userId", document.reviewStartedLockBy, userId)
      if (document && document.reviewStartedLockBy && document.reviewStartedLockBy.toString() === userId) {
        return cb()
      }
      cb({ ...HTTP_ERROR_MESSAGES.FORBIDDEN, message: "You can't review this file" })
    }],
    updateDocument: ['checkFileLockedByUser', "Pages", (results, cb) => {
      const { document, Pages } = results;
      if (document) {
        const pageChanged = {};
        const newPageData = {};
        const updateFields = {}
        const mappedFieldArray = fieldArray.map((item) => {
          const obj = {};
          if (item.fieldId) {
            obj.fieldId = item.fieldId;
          }
          if (item.fieldValue || item.fieldValue === '') {
            obj.local_value = {
              edited_value: item.fieldValue,
            };
          }
          if (item.pts) {
            obj.local_value = obj.local_value || {};
            obj.local_value = {
              ...(obj.local_value),
              pts: item.pts,
            };
          }
          if (item.qc_error_type !== 'undefined') {
            obj.qc_error_type = item.qc_error_type
          }
          if (item.updatedPageNo) {
            pageChanged[item.fieldId] = item.updatedPageNo
          }
          updateFields[obj.fieldId] = obj
          return obj;
        });
        if (Pages && Pages[0]) {
          document.pageArray = Pages
        }
        const { pageArray = [], mapping = {} } = document;
        // console.log("mappedPageArray after mapping orginal", JSON.stringify(pageArray))

        const mappedPageArray = pageArray.map((page) => {
          const { nonTabularContent = [] } = page;
          const merged = nonTabularContent.map(f => {
            const field = f
            if (field && updateFields[field.fieldId]) {
              field.local_value = { ...field.local_value, ...updateFields[field.fieldId].local_value }
              field.qc_error_type = updateFields[field.fieldId].qc_error_type || field.qc_error_type || null
            }
            return f
          })
          if (Object.keys(pageChanged).length) {
            merged.forEach(field => {
              if (pageChanged[field.fieldId]) {
                if (!newPageData[pageChanged[field.fieldId]]) {
                  newPageData[pageChanged[field.fieldId]] = [field]
                } else {
                  newPageData[pageChanged[field.fieldId]].push(field)
                }
                field.changedPageNo = true
              }
            })
          }
          return { ...page, reviewed: !!isFinalized, nonTabularContent: merged.filter(e => !(e.changedPageNo)) };
        })
        // const mappedPageArray = pageArray.map((page) => {
        //   if (page.pageNo === pageId) {
        //     const { nonTabularContent = [] } = page;
        //     const merged = _(nonTabularContent) // start sequence
        //       .keyBy('fieldId') // create a dictionary of the 1st array
        //       .merge(_.keyBy(mappedFieldArray, 'fieldId')) // create a dictionary of the 2nd array, and merge it to the 1st
        //       .values() // turn the combined dictionary to array
        //       .value(); // get the value (array) out of the sequence
        //     // const updatedPageData = pageChanged.newPage
        //     if (Object.keys(pageChanged).length) {
        //       merged.forEach(field => {
        //         if (pageChanged[field.fieldId]) {
        //           if (newPageData[pageChanged[field.fieldId]]) {
        //             newPageData[pageChanged[field.fieldId]] = [field]
        //           } else {
        //             newPageData[pageChanged[field.fieldId]].push(field)
        //           }
        //           field.changedPageNo = true
        //         }
        //       })
        //     }
        //     return { ...page, reviewed: !!isFinalized, nonTabularContent: merged.filter(e => !(e.changedPageNo)) };
        //   }
        //   return page;
        // });
        // console.log("mappedPageArray after mapping before", JSON.stringify(mappedPageArray))
        console.log("neew Page data", JSON.stringify(newPageData))

        mappedPageArray.forEach((page) => {
          const { pageNo, nonTabularContent } = page
          if (newPageData[pageNo]) {
            newPageData[pageNo].forEach(p => { delete p.changedPageNo })
            if (nonTabularContent && nonTabularContent.length) {
              page.nonTabularContent = nonTabularContent.concat(newPageData[pageNo])
            } else {
              page.nonTabularContent = newPageData[pageNo]
            }
          }
          if (tabularContentObj[page.pageId]) {
            // TODO update table content update tabulaR CONTENT WITB TABLE ID WITH
            page.tabularContent = tabularContentObj[page.pageId]
          }
        })

        const criteria = { _id: documentId };
        const dataToSet = {
          updatedBy: userId,
          pageArray: mappedPageArray,
        };
        if (flagVendorExistsChangedToTrue) {
          dataToSet.flagVendorExists = true; // if indexer has changed it, mark it as true for supervisor
        }
        if (isFinalized) {
          dataToSet.status = 'IN_REVIEW';
          dataToSet.qcStatus = 'COMPLETED'
          if (qcFromSupervisorScreen) {
            dataToSet.reviewAcceptedBy = userId
            dataToSet.revieweAcceptedAt = new Date()
          } else {
            dataToSet.reviewedBy = userId
            dataToSet.reviewedAt = new Date()
          }
          if (role !== "ENTERPRISE_INDEXER" && !qcFromSupervisorScreen) {
            dataToSet.reviewedAt = new Date()
            dataToSet.reviewedBy = userId
            dataToSet.reviewAcceptedBy = userId
            dataToSet.revieweAcceptedAt = new Date()
          }
          dataToSet.reviewRole = role
        }
        if (status) {
          dataToSet.status = status;
          if (status === 'HOLD') {
            dataToSet.hold = [{ by: userId, reason }]
          }
        }
        if (docType) {
          dataToSet.docType = docType;
          // update mapping
          dataToSet.mapping = {
            ...mapping,
            'Document type': docType,
          };
        }
        if (header_table) {
          dataToSet.header_table = document.uploadedDocType === "BOL" ? "L" : header_table;
        }
        // console.log("dataToSetdataToSetdataToSetdataToSet:", JSON.stringify(dataToSet))
        edited_value = dataToSet.pageArray.filter(data => data.nonTabularContent.filter(e => e.local_value.edited_value).length)
        if (Pages && Pages[0]) {
          updatedPages = dataToSet.pageArray
          dataToSet.pageArray = []
        }
        documentService.update(
          criteria,
          { $set: dataToSet },
          { new: true, projection: _documentProjection, lean: true },
          (err, result) => {
            if (err) {
              return cb(err);
            }
            return cb(null, {
              data: result,
              ...HTTP_SUCCESS_MESSAGES.UPDATED,
            });
          },
        );
      }
    }],
    updateDocPages: ["updateDocument", ({ Pages, document }, cb) => {
      console.log("DOC::::::::::::::::::::::::::::::::::::: processDocumentPdfGenerator")
      if (!(Pages && Pages[0])) {
        return cb()
      }
      updatePages({ documentId: document._id, idpId: document.idpId, pageArray: updatedPages }, cb)
    }],
    updateCellInoMetaData: ['updateDocPages', (_, cb) => {
      return cb(null, null)
      // if (!isFinalized) {
      // }
      // updateCellInfo(tabularContentCellInfoMetaObj, cb)
    }],
    updateModifiedCount: ['updateDocPages', ({ updateDocument }, cb) => {
      // const edited_value = updateDocument.data.pageArray.filter(data => data.nonTabularContent.filter(e => e.local_value.edited_value).length)
      if (isFinalized && edited_value && edited_value[0]) { // modifiedCount count for passed files
        const INC = { modifiedCount: 1 }
        idpService.update({ _id: updateDocument.data.idpId }, { $inc: INC }, (err) => {
          if (err) {
            return cb(err);
          }
          return cb(null, true);
        });
      } else {
        cb(null, true)
      }
    }],
    qcSharedDb: ['updateDocPages', ({ updateDocument }, cb) => {
      return cb()
      // if (!isFinalized) {
      //   return cb(null, null)
      // }
      // console.log("qc started::::")
      // let nonTabularContent;
      // // let tabularContent = {};
      // if (updateDocument && updateDocument.data && updateDocument.data.pageArray[0]) {
      //   ocrOutputLink = updateDocument.data.pageArray[0].ocr_output_link;
      //   nonTabularContent = updateDocument.data.pageArray[0].nonTabularContent || [];
      //   // tabularContent = updateDocument.data.pageArray[0].tabularContent || {}
      // }
      // const nonTabularError = {}
      // nonTabularContent.forEach((r) => {
      //   if (r.qc_error_type && r.qc_error_type !== 'NONE') {
      //     nonTabularError[r.global_key] = r.qc_error_type
      //   }
      // })
      // const tabularError = {} // tabularContent
      // if (!Object.keys(nonTabularError).length && !Object.keys(nonTabularError).length) {
      //   return cb(null, null)
      // }
      // if (Object.keys(nonTabularError).length) {
      //   nonTableFlagChanged = true;
      // }
      // if (Object.keys(tabularError).length) {
      //   tableFlagChanged = true;
      // }
      // sharedMongodb.updateDocument({ nonTabularError, tabularError, _id: updateDocument.data._id }, (err, res) => {
      //   // console.log("SHARED MONGODB UPDATED: ERR<RES", err, res)
      // })
    }],
    removeDrafts: ['updateDocPages', (_, cb) => {
      if (!isFinalized) {
        return cb()
      }
      BACKUP_DOCUMENT.deleteMany({ documentId }, cb)
    }],
    documentToQc: ['qcSharedDb', ({ document }, cb) => {
      return cb();
      if (!isFinalized) { // one of the flaogs must be changed
        return cb(null, null)
      }
      documentQc({ tenantId: document.tenantId }, { id: documentId }, { tableFlag: tableFlagChanged || null, nonTableFlag: nonTableFlagChanged || null, ocrOutputLink }, false, cb)
    }],
    vendorUpdate: ['updateDocPages', ({ updateDocument, document }, cb) => {
      console.log("vendorAiUpdate")
      if (!isFinalized) {
        return cb(null, null)
      }
      if (updateDocument && updateDocument.data) {
        updateDocument.data.columnType = document.header_table
        updateDocument.data.columnTypeUpdated = header_table || ""
      }
      console.log("vendorAiUpdate call")
      vendorAiUpdate(userId, updateDocument.data, cb);
    }],
    fileUpdate: ["updateDocument", ({ document }, cb) => {
      // if (role === INDEXER || !isFinalized) {
      //   return cb()
      // }
      checkFileReviewed(document, true, qcFromSupervisorScreen, (err, reviewed = false) => { // check batch reviewed
        console.log("reviewed: qcFromSupervisorScreen:", reviewed, qcFromSupervisorScreen)
        if (reviewed) {
          const dataToSet = { isFileReviewed: true, reviewStartedLockBy: null, reviewStartedLockAt: null }
          documentService.updateAll({ idpId: document.idpId }, { $set: dataToSet }, null, () => {
            // TODO send release lock revent
            EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: document.tenantId, batchId: document.idpId, eventType: "FILE_STATUS CHANGED", fileName: document.fileName });
          })
        }
      })
      cb()
    }],
  }, (err, { document, updateDocument }) => {
    if (err) {
      return hcb(err);
    }
    if (isFinalized) {
      console.log("file check done for supervisor assign 840")
      if (role === INDEXER && isFinalized) {
        document.userId = userId
        document.email = email
        fileSendToSupervisor(document, () => {
          console.log("file check done for supervisor assign")
          documentQc({ role, tenantId, email }, { id: documentId }, { tableFlag: tableFlagChanged || null, nonTableFlag: nonTableFlagChanged || null, ocrOutputLink }, false, () => { })
        })
      } else {
        console.log("file check done for supervisor assign 847")
        documentQc({ role, tenantId, email }, { id: documentId }, { tableFlag: tableFlagChanged || null, nonTableFlag: nonTableFlagChanged || null, ocrOutputLink }, false, () => { })
      }
    }
    // if (!isFinalized) { // one of the flaogs must be changed
    //   return cb(null, null)
    // }
    payload['createdBy'] = `${email}(${role})`;
    payload.idpId = document && document.idpId
    EMIT_EVENT('SAVE_LOG', { data: payload, from: `DOCUMENT_UPDATE_API` });
    const eventData = {
      role,
      type: `${qcFromSupervisorScreen ? "REVIEW" : "QC"}_END`,
      userId,
      idpId: document.idpId,
      fileOriginalName: document && document.fileOriginalName,
      documentId
    }
    EMIT_EVENT("SAVE_USER_ACTION", eventData);
    return hcb(null, updateDocument);
  });
};

/**
 * document documentsForceUpdate
 * @param {Object} userInfo
 * @param {Object} params
 * @param {Object} payload
 * @returns
 */
const documentsForceUpdate = async ({ id: userId, email, role, tenantId }, { id: documentId }, payload, hcb) => {
  const {
    fieldArray = [], isFinalized = false, pageId, docType = null, status, reason = '', qcFromSupervisorScreen = false, tables = []
  } = payload;
  const tableFlagChanged = false;
  const nonTableFlagChanged = false;
  let flagVendorExistsChangedToTrue = false;
  let ocrOutputLink
  let updatedPages = null
  const tabularContentObj = {}
  tables.forEach((td) => {
    // tabularContentCellInfoMetaObj[td.pageId] = td.tabularContent.map(c => c.cell_info_metadata)
    tabularContentObj[td.pageId] = td.tabularContent.map(c => {
      const d = c
      // d.cell_info_metadata = [];// make it default to empty for page Array
      return c
    })
  })
  auto({
    document: (cb) => {
      documentService.findOne({ _id: documentId }, {}, {}, null, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (!result) {
          return cb(HTTP_ERROR_MESSAGES.NO_DOC_FOUND);
        }
        return cb(null, result);
      });
    },
    Pages: (cb) => {
      PAGE.find({ documentId }).lean().exec(cb)
    },
    checkFileLockedByUser: ['document', ({ document }, cb) => {
      if (!document.flagVendorExists && document.docType !== "#NEW_FORMAT#") {
        const changedKeys = {}
        let vendorChanged = false
        fieldArray.forEach(e => {
          changedKeys[e.fieldId] = e.fieldValue
        })
        document.pageArray.forEach(p => {
          p.nonTabularContent.forEach(e => {
            // [e.global_key]
            if (e.global_key === 'Vendor ID' || e.global_key === 'Vendor Name' || e.global_key === 'Vendor Address') {
              if (e.local_value && changedKeys[e.fieldId] && (e.local_value.text !== changedKeys[e.fieldId])) {
                vendorChanged = true;
                flagVendorExistsChangedToTrue = true;
              }
            }
          })
        })
        //   if (!vendorChanged) {
        //     return cb({ ...HTTP_ERROR_MESSAGES.FORBIDDEN, message: "Vendor not found in vendor list vendor change required" })
        //   }
      }
      return cb() // update Without data validation
      // console.log("document.reviewStartedLockBy === userId", document.reviewStartedLockBy, userId)
      // if (document.reviewStartedLockBy && document.reviewStartedLockBy.toString() === userId) {
      //   return cb()
      // }
      // cb({ ...HTTP_ERROR_MESSAGES.FORBIDDEN, message: "You can't review this file" })
      // if (process.env.NODE_ENV === "scalar") {
      //   cb({ ...HTTP_ERROR_MESSAGES.FORBIDDEN, message: "You can't review this file" })
      // } else {
      //   cb()
      // }
    }],
    updateDocument: ['checkFileLockedByUser', 'Pages', (results, cb) => {
      const { document, Pages } = results;
      if (document) {
        const pageChanged = {};
        const newPageData = {};
        const updateFields = {}
        const mappedFieldArray = fieldArray.map((item) => {
          const obj = {};
          if (item.fieldId) {
            obj.fieldId = item.fieldId;
          }
          if (item.fieldValue || item.fieldValue === '') {
            obj.local_value = {
              edited_value: item.fieldValue,
            };
          }
          if (item.pts) {
            obj.local_value = obj.local_value || {};
            obj.local_value = {
              ...(obj.local_value),
              pts: item.pts,
            };
          }
          if (item.qc_error_type !== 'undefined') {
            obj.qc_error_type = item.qc_error_type
          }
          if (item.updatedPageNo) {
            pageChanged[item.fieldId] = item.updatedPageNo
          }
          updateFields[obj.fieldId] = obj
          return obj;
        });
        if (Pages && Pages[0]) {
          document.pageArray = Pages
        }
        const { pageArray = [], mapping = {} } = document;
        // console.log("mappedPageArray after mapping orginal", JSON.stringify(pageArray))

        const mappedPageArray = pageArray.map((page) => {
          const { nonTabularContent = [] } = page;
          const merged = nonTabularContent.map(f => {
            const field = f
            if (field && updateFields[field.fieldId]) {
              field.local_value = { ...field.local_value, ...updateFields[field.fieldId].local_value }
              field.qc_error_type = updateFields[field.fieldId].qc_error_type || field.qc_error_type || null
            }
            return f
          })
          if (Object.keys(pageChanged).length) {
            merged.forEach(field => {
              if (pageChanged[field.fieldId]) {
                if (!newPageData[pageChanged[field.fieldId]]) {
                  newPageData[pageChanged[field.fieldId]] = [field]
                } else {
                  newPageData[pageChanged[field.fieldId]].push(field)
                }
                field.changedPageNo = true
              }
            })
          }
          return { ...page, reviewed: !!isFinalized, nonTabularContent: merged.filter(e => !(e.changedPageNo)) };
        })
        // const mappedPageArray = pageArray.map((page) => {
        //   if (page.pageNo === pageId) {
        //     const { nonTabularContent = [] } = page;
        //     const merged = _(nonTabularContent) // start sequence
        //       .keyBy('fieldId') // create a dictionary of the 1st array
        //       .merge(_.keyBy(mappedFieldArray, 'fieldId')) // create a dictionary of the 2nd array, and merge it to the 1st
        //       .values() // turn the combined dictionary to array
        //       .value(); // get the value (array) out of the sequence
        //     // const updatedPageData = pageChanged.newPage
        //     if (Object.keys(pageChanged).length) {
        //       merged.forEach(field => {
        //         if (pageChanged[field.fieldId]) {
        //           if (newPageData[pageChanged[field.fieldId]]) {
        //             newPageData[pageChanged[field.fieldId]] = [field]
        //           } else {
        //             newPageData[pageChanged[field.fieldId]].push(field)
        //           }
        //           field.changedPageNo = true
        //         }
        //       })
        //     }
        //     return { ...page, reviewed: !!isFinalized, nonTabularContent: merged.filter(e => !(e.changedPageNo)) };
        //   }
        //   return page;
        // });
        // console.log("mappedPageArray after mapping before", JSON.stringify(mappedPageArray))
        console.log("neew Page data", JSON.stringify(newPageData))

        mappedPageArray.forEach((page) => {
          const { pageNo, nonTabularContent } = page
          if (newPageData[pageNo]) {
            newPageData[pageNo].forEach(p => { delete p.changedPageNo })
            if (nonTabularContent && nonTabularContent.length) {
              page.nonTabularContent = nonTabularContent.concat(newPageData[pageNo])
            } else {
              page.nonTabularContent = newPageData[pageNo]
            }
          }
          if (tabularContentObj[page.pageId]) {
            // TODO update table content update tabulaR CONTENT WITB TABLE ID WITH
            page.tabularContent = tabularContentObj[page.pageId]
          }
        })
        const criteria = { _id: documentId };
        const dataToSet = {
          updatedBy: userId,
          pageArray: mappedPageArray,
        };
        if (flagVendorExistsChangedToTrue) {
          dataToSet.flagVendorExists = true; // if indexer has changed it, mark it as true for supervisor
        }
        if (isFinalized) {
          dataToSet.status = 'IN_REVIEW';
          dataToSet.qcStatus = 'COMPLETED'
          if (qcFromSupervisorScreen) {
            dataToSet.reviewAcceptedBy = userId
            dataToSet.revieweAcceptedAt = new Date()
          } else {
            dataToSet.reviewedBy = userId
            dataToSet.reviewedAt = new Date()
          }
          if (role !== "ENTERPRISE_INDEXER" && !qcFromSupervisorScreen) {
            dataToSet.reviewedAt = new Date()
            dataToSet.reviewedBy = userId
            dataToSet.reviewAcceptedBy = userId
            dataToSet.revieweAcceptedAt = new Date()
          }
          dataToSet.reviewRole = role
          dataToSet.forceSubmitedBy = userId
        }
        if (status) {
          dataToSet.status = status;
          if (status === 'HOLD') {
            dataToSet.hold = [{ by: userId, reason }]
          }
        }
        if (docType) {
          dataToSet.docType = docType;
          // update mapping
          dataToSet.mapping = {
            ...mapping,
            'Document type': docType,
          };
        }
        // console.log("dataToSetdataToSetdataToSetdataToSet:", dataToSet)
        if (Pages && Pages[0]) {
          updatedPages = dataToSet.pageArray
          dataToSet.pageArray = []
        }
        documentService.update(
          criteria,
          { $set: dataToSet },
          { new: true, projection: _documentProjection, lean: true },
          (err, result) => {
            if (err) {
              return cb(err);
            }
            return cb(null, {
              data: result,
              ...HTTP_SUCCESS_MESSAGES.UPDATED,
            });
          },
        );
      }
    }],
    updateDocPages: ["updateDocument", ({ Pages, document }, cb) => {
      console.log("DOC::::::::::::::::::::::::::::::::::::: processDocumentPdfGenerator")
      if (!(Pages && Pages[0])) {
        return cb()
      }
      updatePages({ documentId: document._id, idpId: document.idpId, pageArray: updatedPages }, cb)
    }],
    updateModifiedCount: ['updateDocument', ({ updateDocument }, cb) => {
      const edited_value = updateDocument.data.pageArray.filter(data => data.nonTabularContent.filter(e => e.local_value.edited_value).length)
      if (isFinalized && edited_value) { // modifiedCount count for passed files
        const INC = { modifiedCount: 1 }
        idpService.update({ _id: updateDocument.data.idpId }, { $inc: INC }, (err) => {
          if (err) {
            return cb(err);
          }
          return cb(null, true);
        });
      } else {
        cb(null, true)
      }
    }],
    qcSharedDb: ['updateDocument', ({ updateDocument }, cb) => {
      return cb()
      // if (!isFinalized) {
      //   return cb(null, null)
      // }
      // console.log("qc started::::")
      // let nonTabularContent;
      // // let tabularContent = {};
      // if (updateDocument && updateDocument.data && updateDocument.data.pageArray[0]) {
      //   ocrOutputLink = updateDocument.data.pageArray[0].ocr_output_link;
      //   nonTabularContent = updateDocument.data.pageArray[0].nonTabularContent || [];
      //   // tabularContent = updateDocument.data.pageArray[0].tabularContent || {}
      // }
      // const nonTabularError = {}
      // nonTabularContent.forEach((r) => {
      //   if (r.qc_error_type && r.qc_error_type !== 'NONE') {
      //     nonTabularError[r.global_key] = r.qc_error_type
      //   }
      // })
      // const tabularError = {} // tabularContent
      // if (!Object.keys(nonTabularError).length && !Object.keys(nonTabularError).length) {
      //   return cb(null, null)
      // }
      // if (Object.keys(nonTabularError).length) {
      //   nonTableFlagChanged = true;
      // }
      // if (Object.keys(tabularError).length) {
      //   tableFlagChanged = true;
      // }
      // sharedMongodb.updateDocument({ nonTabularError, tabularError, _id: updateDocument.data._id }, (err, res) => {
      //   // console.log("SHARED MONGODB UPDATED: ERR<RES", err, res)
      // })
    }],
    documentToQc: ['qcSharedDb', ({ document }, cb) => {
      return cb();
      if (!isFinalized) { // one of the flaogs must be changed
        return cb(null, null)
      }
      documentQc({ tenantId: document.tenantId }, { id: documentId }, { tableFlag: tableFlagChanged || null, nonTableFlag: nonTableFlagChanged || null, ocrOutputLink }, false, cb)
    }],
    vendorUpdate: ['updateDocument', ({ updateDocument }, cb) => {
      if (!isFinalized) {
        return cb(null, null)
      }
      return cb() // return without applying any vendor rules
      // vendorAiUpdate(userId, updateDocument.data, cb);
    }],
    fileUpdate: ["updateDocument", ({ document }, cb) => {
      // if (role === INDEXER || !isFinalized) {
      //   return cb()
      // }
      checkFileReviewed(document, true, qcFromSupervisorScreen, (err, reviewed = false) => { // check batch reviewed
        console.log("reviewed: qcFromSupervisorScreen:", reviewed, qcFromSupervisorScreen)
        if (reviewed) {
          const dataToSet = { isFileReviewed: true, reviewStartedLockBy: null, reviewStartedLockAt: null }
          documentService.updateAll({ idpId: document.idpId }, { $set: dataToSet }, null, () => {
            // TODO send release lock revent
            EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: document.tenantId, batchId: document.idpId, eventType: "FILE_STATUS CHANGED", fileName: document.fileName });
          })
        }
      })
      cb()
    }],
    removeDrafts: ['updateDocPages', (_, cb) => {
      if (!isFinalized) {
        return cb()
      }
      BACKUP_DOCUMENT.deleteMany({ documentId }, cb)
    }],
    batch: ['document', ({ document }, cb) => {
      idpService.findOne({ _id: document.idpId }, { name: 1 }, null, null, cb)
    }]
  }, (err, { document, updateDocument, batch }) => {
    if (err) {
      return hcb(err);
    }
    if (isFinalized) {
      console.log("file check done for supervisor assign 840")
      if (role === INDEXER && isFinalized) {
        document.userId = userId
        document.email = email
        fileSendToSupervisor(document, () => {
          console.log("file check done for supervisor assign")
          documentQc({ role, tenantId, email }, { id: documentId }, { tableFlag: tableFlagChanged || null, nonTableFlag: nonTableFlagChanged || null, ocrOutputLink, qcFromSupervisorScreen }, false, () => { })
        })
      } else {
        console.log("file check done for supervisor assign 847")
        documentQc({ role, tenantId, email }, { id: documentId }, { tableFlag: tableFlagChanged || null, nonTableFlag: nonTableFlagChanged || null, ocrOutputLink, qcFromSupervisorScreen }, false, () => { })
      }
    }
    console.log("batchbatchbatch", batch)
    let apiTarget = "OCR"
    if (tenantId === "641a8d7c9285c7df7da42a6d") { // for mark prod and for mark tenant only
      apiTarget = "QUEUE_SIZE_ALERT2"
    }
    ImcAPIEndPoints.sendEmail({
      apiTarget: "OCR",
      subject: `Force Submit File `,
      body: `
      Hi <br>
      File forcefully submitted by: ${email} ...<br>
      from batch <b>${batch.name}</b> and file <b>${document.fileOriginalName}</b> ...<br>
      Reason: ${reason}     
      `,
    })
      .then(() => { console.log("mail send to internal stack hoders") })
      .catch(e => console.log(e))
    // if (!isFinalized) { // one of the flaogs must be changed
    //   return cb(null, null)
    // }
    payload['createdBy'] = `${email}(${role})`;
    EMIT_EVENT('SAVE_LOG', { data: payload, from: 'DOCUMENT_SUBMITTED_FORCEFULLY' });
    return hcb(null, updateDocument);
  });
};

/**
 * document delete
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const documentDelete = ({ id }, { recordIds }, hcb) => {
  const criteria = {
    _id: {
      $in: recordIds,
    },
  };
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
  };
  documentService.updateAll(criteria, { $set: dataToSet }, {}, (err) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
    });
  });
};

/**
 * document assign
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const documentAssign = ({ id }, payload, hcb) => {
  const { documentIds, ...body } = payload;
  const criteria = {
    _id: { $in: documentIds },
  };
  const dataToSet = {
    assignment: body,
    updatedBy: id,
    status: 'ASSIGNED',
  };
  documentService
    .update(criteria, { $set: dataToSet }, {}, (err) => {
      if (err) {
        return hcb(err);
      }
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.ASSIGN_SUCCESS,

      });
    });
};

/**
 * fetch assigned document
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns
 */
const fetchDocumentAssign = ({ id }, { q = '', limit = 10, offset = 0 }, hcb) => {
  let criteria = {
    isDeleted: false,
    opType: DB_DOC_TYPE.PROCESSING,
    'assignment.accounts': createMongooseId(id),
  };
  if (q) {
    criteria = {
      ...criteria,
      fileName: { $regex: q, $options: 'i' },
    };
  }
  const lookups = [{
    collection: 'users',
    localField: 'assignment.accounts',
    foreignField: '_id',
    outputKey: 'userData',
  }];
  documentService.findAllByAggregation(
    criteria,
    { ..._documentProjection, assignment: 1, userData: 1 },
    lookups,
    { createdAt: -1 },
    offset,
    limit,
    (err, result) => {
      if (err) {
        return hcb(err);
      }
      const { dataList, count } = result[0];
      const totalCount = count[0] && count[0].count ? count[0].count : 0;
      const mappedResponse = dataList.map((item) => {
        const { userData = [], assignment, ...data } = item;
        const mappedUsers = userData.map(({ name, _id }) => ({ name, _id }));
        data.assignedTo = mappedUsers;
        return data;
      });
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: mappedResponse,
        totalCount,
      });
    },
  );
};

/**
 * create download link for download files from frontend
 * @param {Object} __ - userInfo
 * @param {Object} payload
 * @returns
 */
const createDownloadLink = (__, { recordIds }, hcb) => {
  const criteria = {
    _id: { $in: recordIds },
  };
  const projection = { pageArray: 1 };

  auto({
    documents: (cb) => {
      documentService.findAll(criteria, projection, null, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    },
    downloadLinks: ['documents', (results, cb) => {
      const { documents = [] } = results;
      const files = documents
        .map((item) => item.pageArray)
        .flat(Infinity)
        .map((item) => item && item.pageImageLink)
        .filter((item) => item);
      uploadController.createDownloadLink(files)
        .then((downloadLink) => cb(null, {
          ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          data: downloadLink,
        }))
        .catch((err) => cb(err));
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.downloadLinks);
  });
};

/**
 * snipplet documents
 * @param {Array} filesMapping
 */
const documentSnipplets = (__, payload, hcb) => {
  if (process.env.FILE_OCR === "DISABLED") {
    return hcb(HTTP_ERROR_MESSAGES.MAINTENANCE)
  }
  AI_ENDPOINTS.processDocumentSnipplet(payload)
    .then((response) => hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: response || '',
    })).catch((err) => hcb(err));
}

/**
 * used to create JSON/CSV file
 * @param {string} configId
 * @param {Array} docIds
 * @param {Object} filter
 */
const docRetrieveMapping = (
  __,
  {
    batchId = null, docIds = [], filter = {}, type = OUTPUT_EXTENSIONS.JSON,
  },
  hcb,
) => {
  const { isFeedbackApplied = null, isIdentified = null } = filter;
  let filterCriteria = {};
  if (filter && Object.keys(filter).length) {
    if (typeof isFeedbackApplied === 'boolean') {
      filterCriteria = {
        ...filterCriteria,
        isFeedbackApplied,
      };
    }
    if (typeof isIdentified === 'boolean') {
      filterCriteria = {
        ...filterCriteria,
        isTableFlag: true,
        isNonTableFlag: true,
      };
    }
  }
  let criteria = {
    idpId: batchId,
  };
  if (Object.keys(filterCriteria).length) {
    criteria = {
      ...criteria,
      ...filterCriteria,
    };
  }
  if (docIds.length) {
    criteria = {
      ...criteria,
      _id: { $in: docIds },
    };
  }
  const projection = { mapping: 1 };

  auto({
    batch: (cb) => {
      idpService.findOne({ _id: batchId }, { name: 1 }, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    },
    documents: ['batch', (_, cb) => {
      documentService.findAll(criteria, projection, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (result.length === 0) {
          return cb({ status: 400, message: 'Documents not processed by AI yet' });
        }
        return cb(null, result);
      });
    }],
    createDownloadUrl: ['documents', (results, cb) => {
      const { documents = [] } = results;
      const { name: batchName } = results.batch;
      if (type === OUTPUT_EXTENSIONS.CSV) {
        docOutputController.createDocsCsv(documents, batchName)
          .then((url) => cb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: url,
          }))
          .catch((err) => cb(err));
      } else {
        docOutputController.createDocsJson
          .then((url) => cb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: url,
          }))
          .catch((err) => cb(err));
      }
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.createDownloadUrl);
  });
};

const aggregateStats = (tenantId, { fromDate = null, toDate = null }, hcb) => {
  const lookups = [{
    collection: 'configurations',
    localField: 'configId',
    foreignField: '_id',
    outputKey: 'configData',
  }];
  let criteria = {
    tenantId: createMongooseId(tenantId),
  };
  if (fromDate && toDate) {
    criteria = {
      ...criteria,
      createdAt: {
        $gt: new Date(moment(fromDate).subtract(1, 'd').toISOString()),
        $lt: new Date(moment(toDate).add(1, 'd').toISOString()),
      },
    };
  }
  documentService.aggregateStats(
    criteria,
    lookups,
    (err, response) => {
      if (err) {
        return hcb(err);
      }
      const [stats] = response;
      const analytics = {
        uploads: stats?.totalUploads[0]?.data || 0,
        uploadsByStatus: stats.totalUploadsByStatus.map((item) => ({
          name: item._id,
          count: item.data,
        })),
        uploadsWithDate: stats?.uploadsByDate[0]?.data || 0,
        uploadsByStatusWithDate: stats.uploadsByStatus.map((item) => ({
          name: item._id,
          count: item.data,
        })),
        uploadsByDocTypeWithDate: stats.uploadsByDocType.map((item) => ({
          name: item._id,
          count: item.data,
        })),
        uploadsByConfigWithDate: stats.uploadsByConfig.map((item) => ({
          name: item._id,
          count: item.data,
        })),
      };
      return hcb(null, analytics);
    },
  );
};

const _blankBucketResponse = () => [
  {
    count: 0,
    feedbackCount: 0,
    bucketId: 'class1',
    name: 'No Detection',
  },
  {
    count: 0,
    feedbackCount: 0,
    bucketId: 'class2',
    name: 'Key Value Failure',
  },
  {
    count: 0,
    feedbackCount: 0,
    bucketId: 'class3',
    name: 'No Table Detection',
  },
];

const bucketizationDocuments = async ({ tenantId }, { id: batchId }, isQcDone = false, hcb) => {
  const batchInfo = await idpService.findOne({ tenantId, _id: batchId }) || {};
  if (!batchInfo) {
    throw BoomCustomError(400, { message: 'Invalid BatchId' });
  }
  const {
    classes = [],
    identifiedCount: identified = 0,
    nonIdentifiedCount: nonIdentified,
  } = batchInfo;
  if (classes.length) {
    const mappedData = classes.map((item) => {
      const {
        buckets = [],
      } = item;
      const numFeedApplied = buckets.filter((bucket) => bucket.isFeedApplied).length;
      const count = buckets.filter((bucket) => !bucket.isFeedApplied).length;
      return {
        ...item,
        count,
        feedbackCount: numFeedApplied,
      };
    });
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      counts: {
        identified,
        nonIdentified,
      },
      data: mappedData,
    });
  }
  const queryDocs = {
    idpId: batchId,
    corruptFile: false,
    $or: [
      {
        isNonTableFlag: false,
      },
      {
        isTableFlag: false,
      },
      {
        pushToRejected: true
      }
    ]
  };
  // console.log("documents to process with bucketing queryDocs: ", queryDocs);
  const payload = await documentService.findAll(
    queryDocs
  ) || [];
  const mappedPayload = payload.map((item) => {
    const { pageArray = [] } = item;
    const mappedPageArray = pageArray && pageArray.map((page) => ({
      doc_id: item._id.toString(),
      ocr_output_path: page.ocr_output_link,
    }));
    return mappedPageArray;
  }).flat().filter((item) => item);
  if (!mappedPayload.length) {
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      counts: {
        identified,
        nonIdentified,
      },
      data: _blankBucketResponse(),
    });
  }
  try {
    const response = await AI_ENDPOINTS.processBucketing(tenantId, {
      tenantId,
      processed_docs: mappedPayload,
    });
    const customizedBuckets = _customizeBucketResoonse(response);
    if (isQcDone) {
      await _updateFlagsForDocs(customizedBuckets);
    }
    const { classes: bucketClasses = [] } = await idpService.update(
      { tenantId, _id: batchId },
      { $set: { classes: customizedBuckets } },
      {
        projection: {
          'classes.buckets': 0,
        },
        new: true,
      },
    ) || {};
    // update documents wrt buckets
    if (customizedBuckets.length) {
      const documents = customizedBuckets.map((bucket) => {
        const { buckets = [] } = bucket;
        return buckets.map((doc) => ({
          ...doc,
          bucketId: bucket.bucketId,
          bucketName: bucket.name,
        }));
      }).flat();
      await new Promise((resolve) => {
        mapSeries(documents, async (doc, cb) => {
          await documentService.update(
            { _id: doc.docId },
            {
              $addToSet: {
                buckets: {
                  isTaggedAsTrainingDoc: doc.isTrainingDoc,
                  bucketId: doc.bucketId,
                  bucketName: doc.bucketName,
                  bucketCategory: doc.docCategory,
                  isFeedbackAppliedOn: false,
                },
              },
            }, {}, cb
          );
        }, () => resolve(true));
      });
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      counts: {
        identified,
        nonIdentified,
      },
      data: bucketClasses,
    });
  } catch (err) {
    console.log("ERROR IN BUCKET API", err)
    return hcb({
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      counts: {
        identified,
        nonIdentified,
      },
      data: _blankBucketResponse(),
      error: `[AI]: ${err.message}`,
    });
  }
};

const documentQc = ({ tenantId = null, email, role }, { id: documentId }, { qcFromSupervisorScreen, tableFlag = null, nonTableFlag = null, ocrOutputLink = null }, fromRoute = false, hcb) => {
  const criteria = {
    _id: documentId,
    isDeleted: false,
  };
  if (tenantId) {
    criteria.tenantId = tenantId;
  }
  const option = {
    lean: true,
  };
  auto({
    checkDocument: (cb) => {
      documentService.findOne(
        criteria,
        { isQcDone: 1, idpId: 1, qcStatus: 1, externalCustomerId: 1, addressId: 1 },
        option,
        null,
        (err, response) => {
          if (err) {
            return cb(err);
          }
          const { isQcDone = false, idpId: batchId, qcStatus, externalCustomerId, addressId } = response || {};
          return cb(null, {
            isQcDone,
            batchId,
            qcStatus,
            externalCustomerId,
            addressId,
          });
        },
      );
    },
    documentReviewedBySupOrAdmin: ['checkDocument', ({ checkDocument }, cb) => { // any file or doc reviewed by admin or supervisor
      const { batchId } = checkDocument || {};
      if (qcFromSupervisorScreen) {
        return cb()
      }
      documentService.findOne({ idpId: batchId, reviewAcceptedBy: { $exists: true, $nin: [null] } }, { _id: 1 }, null, null, cb)
    }],
    updateAiFlags: ['checkDocument', (_, cb) => {
      return cb()
      // if (fromRoute || !(tableFlag || nonTableFlag) || !ocrOutputLink) {
      //   return cb(null, null); // return without updating as of no change in passed doc flags
      // }
      // const payload = { documentId, ocrOutputLink }
      // if (typeof tableFlag === 'boolean') {
      //   payload.tableFlag = !tableFlag
      // }
      // if (typeof nonTableFlag === 'boolean') {
      //   payload.nonTableFlag = !nonTableFlag
      // }
      // AI_ENDPOINTS.updateFlags(payload)
      //   .then(({ data }) => {
      //     console.log("FLAGS UPDATE RESPNSE", data)
      //     if (data.updated === true) {
      //       console.log("FLAGS UPDETED SUCESS")
      //       cb(null, true)
      //     } else {
      //       console.log("FLAGS UPDETED FAILURE")
      //       cb(null, false)
      //     }
      //   })
      //   .catch((err) => {
      //     console.log("FLAGS UPDATE RESPNSE FAILURE", err)
      //     cb(null, null)
      //   })
    }],
    updateDocSetting: ['updateAiFlags', ({ checkDocument, updateAiFlags }, cb) => {
      const { isQcDone, qcStatus } = checkDocument || {};
      if (isQcDone) {
        return cb()
      }
      const dataToSet = { isQcDone: true, qcStatus, status: 'IN_REVIEW' }
      if (updateAiFlags) {
        dataToSet.pushToRejected = true;
      }
      // console.log("UPDATE QCDONE", updateAiFlags, dataToSet)
      documentService.update(criteria, { $set: dataToSet }, null, (err) => {
        if (err) {
          return cb(err);
        }
        return cb(null, true);
      });
    }],
    updateBatchSetting: ['updateDocSetting', ({ checkDocument }, cb) => {
      const { isQcDone, batchId } = checkDocument || {};
      if (isQcDone) {
        return cb()
      }
      idpService.update({ _id: batchId }, { $inc: { qcCount: 1 } }, null, (err) => {
        if (err) {
          return cb(err);
        }
        return cb(null, true);
      });
    }],
    sendQcDataToBucket: ['updateBatchSetting', ({ checkDocument }, cb) => {
      if (fromRoute) {
        return cb()
      }
      const { batchId } = checkDocument || {};
      console.log("DEBUG DEBUG DEBUG: batchId", batchId)
      const criteria = {
        idpId: batchId,
        qcStatus: { $in: ['STARTED', 'PENDING', 'STOPPED', 'NOT_REQUIRED'] }
      }
      documentService.findAll(criteria, { _id: 1 }, null, (e, doc) => {
        console.log("DEBUG DEBUG DEBUG", e, doc)
        if (e) {
          return cb(null, false)
        }
        if (doc && !doc[0]) {
          return cb(null, true)
        }
        return cb(null, false)
      })
      // idpService.findOne({ _id: batchId }, { qcThresholdPercent: 1, identifiedCount: 1, nonIdentifiedCount: 1, qcCount: 1, qcStatus: 1 }, {}, null,
      //   (err, batch) => {
      //     if (!batch.qcThresholdPercent || batch.qcStatus === 'COMPLETED') {
      //       return cb(null, false);
      //     }
      //     const totalDocs = batch.identifiedCount + batch.nonIdentifiedCount;
      //     const qcDonePercent = Math.floor((batch.qcCount / totalDocs) * 100)
      //     if (qcDonePercent >= 100) {
      //       cb(null, true)
      //       // TODO bucketization  not needed for now
      //       // bucketizationDocuments({ tenantId }, { id: batchId }, true, (err, res) => {
      //       //   if (err) {
      //       //     console.log('TRYING TO BUCKETIZE QC CHECKED DOCUMENTs to but Bucketing ai server is down try again later');
      //       //     return cb(null, false)
      //       //   }
      //       //   console.log("QC BUCKETING DONE", res)
      //       //   return cb(null, true)
      //       // });
      //     } else {
      //       cb(null, false);
      //     }
      //   })
    }],
    updateBatch: ['sendQcDataToBucket', ({ sendQcDataToBucket, checkDocument }, cb) => {
      if (fromRoute) {
        return cb()
      }
      const { batchId } = checkDocument || {};
      let dataToSet
      if (sendQcDataToBucket) {
        dataToSet = { qcStatus: 'COMPLETED' };
      } else {
        return cb(null, false);
      }
      // console.log("data to set: ", batchId.toString(), dataToSet);
      idpService.update({ _id: batchId }, { $set: dataToSet }, null, (err) => {
        if (err) {
          return cb(err);
        }
        return cb(null, true);
      });
    }],
    // updateBatchRejectedCount: ['checkDocument', ({ checkDocument }, cb) => {
    //   if (fromRoute) {
    //     return cb()
    //   }
    //   const { batchId } = checkDocument || {};
    //   let dataToInc = {};
    //   if ((tableFlag || nonTableFlag) && ocrOutputLink) { // if file pushed to one of the rejected buckets
    //     dataToInc = { qcRejectedCount: 1 };
    //   } else {
    //     return cb(null, true)
    //   }
    //   console.log("data to inc: ", batchId.toString(), dataToInc);
    //   idpService.update({ _id: batchId }, { $inc: dataToInc }, null, (err) => {
    //     if (err) {
    //       return cb(err);
    //     }
    //     return cb(null, true);
    //   });
    // }],
    documentToQc: ['updateBatch', 'checkDocument', ({ checkDocument }, cb) => {
      const { batchId } = checkDocument || {};
      documentService.findOne({ idpId: batchId, qcStatus: 'PENDING' }, { _id: 1 }, null, null, cb)
    }],
    allFilesReviewedForBatch: ['sendQcDataToBucket', ({ sendQcDataToBucket, checkDocument }, cb) => {
      const { batchId } = checkDocument || {};
      if (!sendQcDataToBucket) {
        return cb(null, false);
      }
      documentService.findOne({ idpId: batchId, qcStatus: { $in: ['STARTED', 'ASSIGNED_SUPERVISOR', 'PENDING', 'STOPPED', 'NOT_REQUIRED'] } }, { _id: 1 }, null, null, (err, doc) => {
        console.log("allFilesReviewedForBatch e,r", err, doc)
        if (err) {
          return cb(err);
        }
        if (doc) {
          return cb(null, false)
        }
        cb(null, true)
      })
    }],
    updateFiles: ['allFilesReviewedForBatch', ({ allFilesReviewedForBatch, checkDocument, documentReviewedBySupOrAdmin }, cb) => {
      if (fromRoute) {
        return cb()
      }
      console.log("documentReviewedBySupOrAdmin", documentReviewedBySupOrAdmin);
      const { batchId } = checkDocument || {};
      const dataToSet = {}
      if (!qcFromSupervisorScreen && allFilesReviewedForBatch && documentReviewedBySupOrAdmin) {
        dataToSet.qcStatus = "ASSIGNED_SUPERVISOR"
        dataToSet.classification = "ASSIGNED_SUPERVISOR"
      } else {
        return cb(null, false);
      }
      documentService.updateAll({ idpId: batchId, reviewRole: INDEXER }, { $set: dataToSet }, null, (err, response) => {
        if (err) {
          return cb(err);
        }
        console.log("responserespon nModified seresponse", response)
        if (response.nModified > 0) {
          return cb(null, true);
        }
        return cb(null, false);
      });
    }],
    updateDocuments: ['allFilesReviewedForBatch', 'updateFiles', ({ allFilesReviewedForBatch, checkDocument, updateFiles }, cb) => {
      if (fromRoute) {
        return cb()
      }
      // console.log("data to set: ", batchId.toString(), dataToSet);
      const { batchId } = checkDocument || {};
      let dataToSet
      if (allFilesReviewedForBatch && !updateFiles) {
        dataToSet = { isBatchReviewed: true };
        // if (assignBatchToSupervisor) {
        //   dataToSet.qcStatus = "ASSIGNED_SUPERVISOR"
        //   dataToSet.classification = "ASSIGNED_SUPERVISOR"
        // }
      } else {
        return cb(null, false);
      }
      documentService.updateAll({ idpId: batchId }, { $set: dataToSet }, null, (err) => {
        if (err) {
          return cb(err);
        }
        return cb(null, true);
      });
    }]
  }, (err, { documentToQc, checkDocument }) => {
    if (err) {
      return hcb(err);
    }
    EMIT_EVENT("CALL_DOCUMENT_COMPLETATION_API", { tenantId, documentId, externalCustomerId: checkDocument.externalCustomerId, email, role, addressId: checkDocument.addressId });
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { documentToQc } });
  });
};

/**
 * snipplet documents
 * @param {Array} filesMapping
 */
const documentsVendorCorrection = (__, hcb) => AI_ENDPOINTS.processVendorCorrection()
  .then((response) => hcb(null, {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    data: response || '',
  })).catch((err) => hcb(err));

/**
* create download link for download files from frontend
* @param {Object} __ - userInfo
* @param {Object} payload
* @returns
*/
const downloadDocumentFile = (request, h, hcb) => {
  const matchQuery = {
    documentDeleted: false
  }
  const { docId = null, batchId = null, _id = null, fileName: uniquefileName = null, disablePurging = false } = request.query
  if (batchId || docId) {
    matchQuery.external = {}
    if (docId) {
      matchQuery.external.docId = docId
    }
    if (batchId) {
      matchQuery.external.batchId = batchId
    }
  }
  if (_id) {
    matchQuery._id = _id
  }
  if (uniquefileName) {
    matchQuery.fileName = uniquefileName
  }
  let zipArchive = null
  let fileName = null
  let contentType = null
  let files = []
  matchQuery.s3DocumentPdfLink = {
    $exists: true,
    $nin: [''],
  }
  // console.log("DEBUG query param", matchQuery)
  // console.log("DEBUG QERY", matchQuery)
  // console.log("debug")
  auto({
    documentsCount: (cb) => {
      documentService.count(matchQuery, cb)
    },
    documents: (cb) => {
      documentService.findAll(matchQuery, { s3DocumentPdfLink: 1 }, null, cb)
    },
    downloadLinks: ['documents', 'documentsCount', ({ documentsCount, documents }, cb) => {
      if (documentsCount > 1) {
        zipArchive = archiver.create('zip');
        fileName = `${nanoid(15)}.zip`;
        contentType = 'application/zip';
        files = documents
        cb()
      } else if (documentsCount > 0) {
        const doc = documents[0];
        if (doc.s3DocumentPdfLink) {
          const splitArr = doc.s3DocumentPdfLink.split('.');
          const extension = splitArr.length ? splitArr.pop().toLowerCase() : "pdf";
          if (extension.toLowerCase().includes("tif")) {
            contentType = `application/${extension}`;
          } else {
            contentType = 'application/pdf'
          }
        }
        fileName = doc.s3DocumentPdfLink.replace(/^.*\//, '')
        files = [{ s3DocumentPdfLink: doc.s3DocumentPdfLink }]
        cb()
      } else {
        return cb(HTTP_ERROR_MESSAGES.FILE_NOT_FOUND)
      }
    }],
    createSignedUrl: ['downloadLinks', (_, cb) => {
      if (process.env.S3_BUCKET_TYPE === "PUBLIC") {
        return cb()
      }
      eachSeries(files, (file, ecb) => {
        getSingedUrl(file.s3DocumentPdfLink, (e, slink) => {
          file.s3DocumentPdfLink = !e ? slink : file.s3DocumentPdfLink
          ecb()
        })
      }, cb)
    }],
    streamDownload: ['createSignedUrl', (_, cb) => {
      Promise.all(files.map(async ({ s3DocumentPdfLink: url }) => {
        // console.log("DOWNLOADING STARTED FOR: ", url)
        try {
          const res = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
          })
          if (zipArchive) {
            zipArchive.append(res.data, { name: url.replace(/^.*\//, '') });
          }
          return res.data
        } catch (e) {
          console.log("ERROR while download", e)
          return null
        }
      })).then(res => {
        if (zipArchive) {
          zipArchive.finalize();
          return cb(null, zipArchive)
        }
        if (!res[0]) {
          return cb(HTTP_ERROR_MESSAGES.FILE_NOT_FOUND)
        }
        return cb(null, res[0])
      }).catch(e => {
        return cb(HTTP_ERROR_MESSAGES.FILE_NOT_FOUND)
      })
    }],
    sendFile: ['streamDownload', ({ streamDownload }, cb) => {
      cb(null, h.response(streamDownload)
        .type(contentType)
        .encoding('binary')
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename=${fileName}`));
    }],
    sendDocumentToPurging: ['sendFile', (_, cb) => {
      if (disablePurging) {
        return cb()
      }
      matchQuery.documentDownloadedAt = null
      documentService.updateAll(matchQuery, { $set: { documentDownloadedAt: new Date() } }, null, cb)
    }],
  }, (err, { sendFile }) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, sendFile);
  });
};

/**
* create download link for download files from frontend
* @param {Object} __ - userInfo
* @param {Object} payload
* @returns
*/
const startFileReview = ({ id: userId, tenantId, role }, { idpId, fileName, release = false }, callback) => {
  let responseSent = false;
  auto({
    fileLockedByUser: (cb) => {
      const criteria = { reviewStartedLockBy: userId }
      if (!release) {
        criteria.idpId = { $nin: [createMongooseId(idpId)] }
      }
      documentService.findAll(criteria, { fileName: 1, idpId }, null, cb)
    },
    releaseFile: ['fileLockedByUser', (_, cb) => {
      const criteria = { reviewStartedLockBy: userId }
      if (!release) {
        criteria.idpId = { $nin: [createMongooseId(idpId)] }
      }
      const dataToSet = { reviewStartedLockBy: null, reviewStartedLockAt: null }
      documentService.updateAll(criteria, { $set: dataToSet }, null, (e, r) => {
        if (e) {
          return cb(e);
        }
        if (release) {
          responseSent = true
          callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT);
        }
        cb()
      })
    }],
    lockNewFile: (cb) => {
      if (release) {
        return cb()
      }
      const criteria = { idpId }
      const dataToSet = { reviewStartedLockBy: userId, reviewStartedLockAt: new Date() }
      documentService.updateAll(criteria, { $set: dataToSet }, null, (e, r) => {
        if (e) {
          return cb(e);
        }
        responseSent = true
        callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT);
        cb()
      })
    },
  },
    (err, { fileLockedByUser }) => {
      if (err) {
        return callback(err);
      }
      const eventData = {
        role,
        type: `BATCH_${release ? "RELEASE" : "LOCK"}`,
        userId,
        idpId
      }
      if (release) {
        EMIT_EVENT("SAVE_USER_ACTION", eventData);
      }
      if (!release) {
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "LOCK_FILE", data: { fileName, idpId, userId } });
      }
      if (fileLockedByUser && fileLockedByUser.length) {
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "RELEASE_FILE", data: fileLockedByUser });
      }
      if (!responseSent) {
        callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT);
      } else {
        console.log("responseSent already sent", responseSent)
      }
    });
};

/**
 * tableCompletion
 * @param {Array} filesMapping
 */
const tableCompletion = (__, payload, hcb) => {
  if (process.env.FILE_OCR === "DISABLED") {
    return hcb(HTTP_ERROR_MESSAGES.MAINTENANCE)
  }
  AI_ENDPOINTS.processTableCompletion(payload)
    .then((response) => hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: response || '',
    })).catch((err) => hcb(err));
}

/**
 * autoTableCompletion
 * @param {Array} filesMapping
 */
const autoTableCompletion = (__, payload, hcb) => {
  if (process.env.FILE_OCR === "DISABLED") {
    return hcb(HTTP_ERROR_MESSAGES.MAINTENANCE)
  }
  AI_ENDPOINTS.processAutoTableCompletion(payload)
    .then((response) => hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: response || '',
    })).catch((err) => hcb(err));
}

/**
 * autoTableCompletion
 * @param {Array} filesMapping
 */
const fieldCompletion = (__, payload, hcb) => {
  if (process.env.FILE_OCR === "DISABLED") {
    return hcb(HTTP_ERROR_MESSAGES.MAINTENANCE)
  }
  AI_ENDPOINTS.processFieldCompletion(payload)
    .then((response) => hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: response || '',
    })).catch((err) => hcb(err));
}

module.exports = {
  bucketizationDocuments,
  documentList,
  documentListIMC,
  documentDetail,
  documentQc,
  documentDelete,
  documentAssign,
  fetchDocumentAssign,
  documentUpdate,
  documentSnipplets,
  createDownloadLink,
  docRetrieveMapping,
  aggregateStats,
  _blankBucketResponse,
  documentsVendorCorrection,
  downloadDocumentFile,
  startFileReview,
  documentsForceUpdate,
  tableCompletion,
  autoTableCompletion,
  fieldCompletion,
};
