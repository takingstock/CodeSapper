/* eslint-disable class-methods-use-this */
const { mapSeries, eachOfSeries, eachLimit } = require('async');
const { join } = require('path');
const { auto } = require('async');
const moment = require('moment');
const fsXtra = require('fs-extra');
const { writeFile, readFile } = require('fs');
const config = require('config');
const axios = require('axios');

const { _customizeOcrResponseMultiPage, _customizeOcrResponse } = require('../Helpers/ocr');
const mappingController = require('./mapping.controller');
const { BoomCustomError, createMongooseId, createNewMongooseId } = require('../Utils/universal-functions.util');
const { userService, globalMappingService, credentialService, tenantService, workflowService, documentService, idpService } = require('../Services');
const VENDOR_MAPPING = require('../Models/vendor-mapping-model');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const { sendEmail } = require('../Utils/imc-endpoints.util');
const { mappedAiServers } = require('../Utils/serverMapping');
const { AI_STATUS } = require('../config/default');
const { createPages } = require('../Utils/page.util')
const { DEFAULT_CONTENT } = require("../Mock/non-tabular-content")

const IDP_BACKUP = require('../Models/idp-documentlist-backup.model');
const ENV_CONFIG = require('../Models/env-config.model')
const PAGE = require('../Models/page.model');
const { updatePages } = require("../Utils/page.util")
const { generateDocNumbers } = require('./splitFile.controller')

const SOCKET_EVENTS = config.get('SOCKET_EVENTS');
const APP_EVENTS = config.get('APP_EVENTS');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');

const _fetchWithAxios = async (url) => axios({
  method: 'get',
  url,
})
  .then((data) => data.data)
  .catch((err) => err);

// update global mapping
const updateGlobalMapping = async ({ json = [], tenantIds = [] }) => {
  let inputTenantIds = [...tenantIds];
  if (!inputTenantIds.length) {
    const users = await userService.findAll({ tenantId: { $ne: null } });
    inputTenantIds = users.map((item) => item.tenantId);
  }
  try {
    const response = await new Promise((resolve, reject) => {
      mapSeries(inputTenantIds, async (tenantId, cb) => {
        const isTenantIdExist = await globalMappingService.findOne({ tenantId });
        if (isTenantIdExist) {
          const mapped = json.map((w) => ({
            ...w,
            tenantId,
          }));
          // update global mapping
          await globalMappingService.remove({ tenantId });
          await globalMappingService.createMany(mapped);
        }
        cb(null, {
          message: `global mapping for customer with ID [${tenantId}] have been updated`,
        });
      }, (err, data) => {
        if (err) {
          return reject(new Error('Unable to update global mapping'));
        }
        return resolve({
          message: 'global mapping updated successfully',
          data,
        });
      });
    });
    return response;
  } catch (err) {
    throw BoomCustomError(400, { message: err.message });
  }
};

const mappingFetchIMC = (
  {
    q = '', sortBy = 'createdAt', orderBy = 'DESC', tenantId = null, docType = null, docId = null,
  },
  hcb,
) => {
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  let criteria = {
    isDeleted: false,
  };
  if (tenantId) {
    criteria = { ...criteria, tenantId: createMongooseId(tenantId) };
  }
  if (docType) {
    criteria = { ...criteria, documentType: { $regex: docType, $options: 'i' } };
  }
  const projection = {
    docType: "$documentType", keys: "$mapping", isTablePresent: 1, columns: 1, docCategory: 1, docSlug: 1,
  };
  if (q) {
    criteria = {
      ...criteria,
      documentType: { $regex: q, $options: 'i' },
    };
  }
  let workflowId = null; // set it using docId
  auto({
    document: (cb) => {
      if (docId) {
        documentService.findOne({ _id: docId }, { configId: 1 }, null, null, (err, Document) => {
          if (err) {
            cb(err)
          } else {
            if (Document && Document.configId) {
              workflowId = Document.configId;
            }
            cb(null, true)
          }
        })
      } else {
        cb(null, true)
      }
    },
    workflow: ['document', (_, cb) => {
      if (workflowId) {
        workflowService.findOne({ _id: workflowId }, { docIds: 1 }, null, null, (err, Workflow) => {
          if (err) {
            cb(err)
          } else {
            if (Workflow && Workflow.docIds && Workflow.docIds.length) {
              criteria = {
                ...criteria,
                _id: { $in: Workflow.docIds.map(m => m.docId) }
              };
            }
            cb(null, true)
          }
        })
      } else {
        cb(null, true)
      }
    }],
    aggrgate: ['workflow', (_, cb) => {
      globalMappingService.findAllByAggregation(
        criteria,
        projection,
        [],
        sortObj,
        0,
        0,
        (err, response) => {
          if (err) {
            return cb({ message: err.message });
          }
          const { dataList = [] } = response[0];
          return cb(null, null);
        }
      );
    }]
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.aggrgate);
  })
};

// write mock json for demo & prod
const updateDemoOcr = ({ url = null }, hcb) => {
  auto({
    fetchAxios: (cb) => _fetchWithAxios(url).then((data) => cb(null, data)),
    writeFile: ['fetchAxios', (results, cb) => {
      const { fetchAxios } = results;
      const filePath = join(__dirname, '../', 'demo.json');
      fsXtra.ensureFileSync(filePath);
      writeFile(filePath, JSON.stringify(fetchAxios), (err) => {
        if (err) {
          return cb(err);
        }
        return cb(null, {
          data: fetchAxios,
          message: 'file written successfully',
        });
      });
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.writeFile);
  });
};

const fetchDemoOcr = (hcb) => {
  try {
    const filesToReadPath = join(__dirname, '../', 'demo.json');
    fsXtra.ensureFileSync(filesToReadPath);
    readFile(filesToReadPath, 'utf8', (err, data) => {
      if (err) {
        return hcb(err);
      }
      return hcb(null, JSON.parse(data));
    });
  } catch (err) {
    return hcb({ message: err.message });
  }
};

const fetchCredentials = (_, { tenantId, cred_type: credType }, hcb) => {
  credentialService.findOne(
    { tenantId },
    {
      createdBy: 0, updatedBy: 0, isDeleted: 0, deletedBy: 0,
    },
    (err, response) => {
      if (err) {
        return hcb({ message: err.message });
      }
      if (response) {
        return {
          ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          data: {
            [credType]: response[credType],
          },
        };
      }
      return {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: null,
      };
    },
  );
};

const userUpdateIMC = ({ id: recordId }, { status, expiryInDays = 0 }, hcb) => {
  auto({
    isRecordExist: (cb) => {
      userService.findOne({ _id: recordId, isTrialAccount: true }, null, null, null, cb);
    },
    user: ['isRecordExist', ({ isRecordExist }, cb) => {
      if (!isRecordExist) {
        return cb(HTTP_ERROR_MESSAGES.USER_NOT_FOUND)
      }
      const dataToUpdate = {};
      if (typeof status === 'boolean') {
        dataToUpdate.isTrialAccountSuspended = status;
      }
      if (expiryInDays) {
        dataToUpdate.trialEndDate = moment().add(expiryInDays, 'days').toDate();
      }
      userService.update({ _id: recordId }, {
        $set: dataToUpdate,
      }, { new: true }, cb);
    }]
  }, (err, { user }) => {
    if (err) {
      return hcb(err)
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.UPDATED,
      data: user,
    })
  })
}
const userDeleteIMC = ({ recordIds = [] }, hcb) => {
  mapSeries(recordIds, (recordId, mcb) => {
    auto({
      isRecordExist: (cb) => {
        userService.findOne({ _id: recordId }, null, null, null, cb);
      },
      deleteTenant: ['isRecordExist', ({ isRecordExist }, cb) => {
        if (isRecordExist) {
          tenantService.deleteMany({ _id: isRecordExist.tenantId }, cb);
        } else {
          cb(HTTP_ERROR_MESSAGES.USER_NOT_FOUND)
        }
      }],
      deleteUser: ['isRecordExist', ({ isRecordExist }, cb) => {
        if (isRecordExist) {
          userService.deleteMany({ _id: recordId }, cb);
        } else {
          cb(HTTP_ERROR_MESSAGES.USER_NOT_FOUND)
        }
      }]
    }, (err, res) => {
      if (err) {
        return mcb(err)
      }
      mcb(null, res)
    })
  }, (err) => {
    if (err) {
      return hcb(err)
    }
    hcb(null, { ...HTTP_SUCCESS_MESSAGES.DELETE_USER, data: recordIds })
  });
}
const _ocrMapping = (ocr, file, hcb) => {
  return hcb(null, {})
  mappingController.mappingOcrFields(
    file.configId,
    ocr,
    file,
  ).then(mapping => {
    return hcb(null, mapping)
  }).catch(e => {
    console.log("error mapping in multi 312 page/doc", e)
  })
}
const _newDocument = (data, hcb) => {
  auto({
    saveJSON: (cb) => {
      return cb()
      // var fs = require('fs');
      // const path = require('path')
      // console.log("path.join(__dirname, '../../..', 'myjsonfile.json'),",path.join(__dirname, '../../..', 'myjsonfile.json'))
      // fs.writeFile(path.join(__dirname, '../../..', 'myjsonfile.json'), JSON.stringify(data), 'utf8', cb);
    },
    doc: ['saveJSON', (_, cb) => {
      const dataToAdd = { ...data, pageArray: [] } // skip pageArray on doc shema will add pages on pageschema

      documentService.create(dataToAdd, cb)
    }],
    addPages: ["doc", ({ doc }, cb) => {
      console.log("DOC:::::::::::::::::::::::::::::::::::::", doc)
      createPages({ documentId: doc._id, idpId: data.idpId, pageArray: data.pageArray, fileName: data.fileName, tenantId: doc.tenantId }, cb)
    }],
    updateBatch: ['doc', ({ doc }, cb) => {
      idpService.update({ _id: doc.idpId }, { $inc: { filesCount: 1 } }, null, cb)
    }]
  }, (err, { doc }) => {
    if (err) {
      console.log("ERR on 326", err)
      // console.log("ERR on 327", data)
    }
    hcb(null, doc)
  })
}
const _ocrMappingWithNewDocument = (ocrResponse = [], file, s3_link_final_output, ocrResponseTime, hcb) => {
  const updatedOcrResponse = []
  const dataToSave = file
  if (Array.isArray(ocrResponse) && ocrResponse.length) {
    const d = ocrResponse.map(d => ({ ...dataToSave, ...d, ocrResponseTime, s3_link_final_output }))
    // console.log("DDDDDDDDDDDDD", d.length)
    eachOfSeries(d, (item, key, ecb) => {
      if (!d[key + 1]) { // update file doc at the end for usefull for backup batch
        documentService.updateAll({ _id: item._id, aiStatus: { $nin: [AI_STATUS.OCR_DONE] } }, { $set: { ...item, pageArray: [], docNumber: Number(key) + 1 } }, null, () => {
          createPages({ documentId: item._id, idpId: item.idpId, pageArray: item.pageArray, fileName: item.fileName, tenantId: item.tenantId }, ecb)
        })
      } else {
        delete item._id
        // delete item.createdAt
        delete item.updatedAt
        item.ocrResponseTime = ocrResponseTime
        item.ocrRequestTime = ocrResponseTime // make it zero for new doc for file
        item.docNumber = Number(key) + 1;
        _newDocument(item, (err, doc) => {
          if (!doc) {
            console.log("DOC NOT CREATED", err)
            return ecb(null, null)
          }
          _ocrMapping(ocrResponse[key], doc, (e, mapping = {}) => {
            updatedOcrResponse.push({
              _id: doc._id,
              ...ocrResponse[key],
              mapping
            })
            ecb(null, mapping)
          })
        })
      }
    }, (e) => {
      if (e) {
        console.log("eachofSeries error", e)
      }
      return hcb(null, updatedOcrResponse)
    })
  } else {
    if (!ocrResponse) {
      return hcb(null, [])
    }
    _ocrMapping(ocrResponse, file, (e, mapping = {}) => {
      updatedOcrResponse.push({
        ...ocrResponse,
        mapping
      })
      hcb(null, updatedOcrResponse)
    })
  }
}
const recentWebhookResponses = {};
/**
 * update document from ai
 * @param {*} payload
 * @param {*} hcb
 */
const updateDocumentOcr = (request, hcb) => {
  const ipAddress = request.headers['x-real-ip'] || request.info.remoteAddress;
  const { payload } = request;
  if (recentWebhookResponses.hasOwnProperty(payload.doc_id)) {
    console.log("FILE ALREADY OCR_COMPLETED", payload.doc_id)
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP | OCR |',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url: ipAddress,
        apiType: 'DOCUMENT_OCR WEBHOOK',
        error: "simultaneous load balancer response",
        documentId: payload.doc_id,
        message: "FILE ALREADY OCR COMPLETED",
        s3FilePathOriginal: `NA`
      }),
    }).then(() => { console.log("mail sent") }).catch(() => { })
    setTimeout(() => {
      process.emit("lockIp", { ocrUrl: ipAddress, ipOcrLock: false, from: "IMC CONTROLLER" })
    }, 1000 * 1)
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT });
  }
  recentWebhookResponses[payload.doc_id] = true
  // eslint-disable-next-line prefer-const
  let { data: ocrResponse = [], doc_id: documentId, s3_link_final_output } = payload
  let opType; let tenantId; let batchId;
  // setTimeout(() => {
  //   console.log("OCR RESPONSE AI SERVER after .1 overhead");
  //   process.emit("lockIp", { ocrUrl: ipAddress, ipOcrLock: false, from: "IMC CONTROLLER" })
  // }, 100);
  console.log('incoming payload OCR', JSON.stringify(payload));
  const ocrResponseTime = new Date()
  auto({
    document: (cb) => {
      documentService.findOne({ _id: documentId }, null, { lean: true }, null, cb)
    },
    checkDocument: ['document', ({ document }, cb) => {
      return cb();
    }],
    updateDocument: ['checkDocument', ({ document: file = null }, cb) => {
      if (!file) {
        return cb({ statusCode: 400, message: "document not valid" })
      }
      console.log("FILE: file._id, ipAddress,status ", file._id, ipAddress, file.aiStatus)
      if (file.aiStatus === "OCR_COMPLETED" || (Array.isArray(file.pageArray) && file.pageArray.length)) {
        console.log("FILE ALREADY OCR_COMPLETED")
        sendEmail({
          emails: "auqib@amygb.ai",
          subject: 'AI_BUGS | IDP | OCR |',
          body: JSON.stringify({
            environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
            url: ipAddress,
            apiType: 'DOCUMENT_OCR WEBHOOK',
            error: ocrResponse,
            documentId,
            message: "FILE ALREADY OCR COMPLETED",
            s3FilePathOriginal: `${file.s3Url}`
          }),
        }).then(() => { console.log("mail sent") }).catch(() => { })
        return cb(null, false)
      }
      tenantId = file.tenantId;
      batchId = file.idpId;
      opType = file.opType;
      if (ocrResponse.hasOwnProperty('error') && ocrResponse.error) {
        if (ocrResponse.error === '[AI]--OUTPUT_FAILURE' && ocrResponse.hasOwnProperty("errorCode") && ocrResponse.errorCode === 1) {
          ocrResponse = {
            ...ocrResponse,
            corruptFile: true
          }
        } else {
          sendEmail({
            apiTarget: 'OCR',
            subject: 'AI_BUGS | IDP | OCR',
            body: JSON.stringify({
              environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
              url: ipAddress,
              apiType: 'DOCUMENT_OCR WEBHOOK',
              error: ocrResponse,
              documentId,
              fileOriginalName: file.fileOriginalName,
              s3FilePathOriginal: `${file.s3Url}`
            }),
          }).then(() => { console.log("mail sent") }).catch(() => { })
        }
        if (file.ocrRetry !== 2 && file.aiStatus !== AI_STATUS.OCR_DONE) {
          documentService.update({ _id: documentId }, { $set: { ocrRetry: 2, aiStatus: AI_STATUS.OCR_PENDING } }, () => { console.log("sent for retry") }) // send for retry
          ocrResponse = [];
          return cb(null, false)
        }
      } else if (file.ocrRetry >= 1) {
        sendEmail({
          apiTarget: 'OCR',
          subject: 'RETRY SUCCESS | IDP | OCR',
          body: JSON.stringify({
            environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
            url: ipAddress,
            apiType: 'DOCUMENT_OCR WEBHOOK',
            message: `File ocr success on ${file.ocrRetry + 1} try`,
            documentId,
            ocrRetry: file.ocrRetry,
            fileOriginalName: file.fileOriginalName,
            s3FilePathOriginal: `${file.s3Url}`
          }),
        }).then(() => { console.log("mail sent") }).catch(() => { })
      }
      // console.log("multipage response", JSON.stringify(_customizeOcrResponseMultiPage(ocrResponse)));
      ocrResponse = _customizeOcrResponseMultiPage(ocrResponse, file.fileOriginalName);
      ocrResponse.sort((a, b) => a.pageEnd - b.pageEnd)
      _ocrMappingWithNewDocument(ocrResponse, file, s3_link_final_output, ocrResponseTime, (e, response) => {
        // console.log("ERRRRRR,RES,", e, response)
        if (!e) {
          ocrResponse = response
        }
        cb(null, true)
      })
      // create mapping from the response
    }],
    updateBatch: ['updateDocument', ({ updateDocument }, cb) => {
      if (!updateDocument) {
        return cb()
      }
      idpService.update({ _id: batchId }, { $set: { ocrResponseTime } }, null, cb);
    }],
    updateDocNumbers: ['updateDocument', ({ updateDocument }, cb) => {
      if (!updateDocument) {
        return cb()
      }
      cb()
      generateDocNumbers({ documentId }, (e,) => {
        console.log("doc number generation done", batchId)
        console.log("doc number generation done", e)
      })
    }],
  }, (err, { document }) => {
    if (err) {
      console.log("ERROR ON 405")
      hcb(err);
    } else {
      hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT });
    }
    const payload = { doc_id: documentId, s3_link_final_output }
    payload['idpId'] = document && document.idpId
    payload['createdBy'] = `AI_WEBHOOK_OCR`;
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: document.tenantId, batchId: document.idpId, eventType: "OCR_WEBHOOK_RESPONSE_RECIEVED", fileName: document.fileName });
    EMIT_EVENT('SAVE_LOG', { data: payload, from: 'RECEIVED_ON_WEBHOOK_FROM_AI' });
    setTimeout(() => {
      console.log("OCR RESPONSE AI SERVER after 1 seconds overhead");
      delete recentWebhookResponses[payload.doc_id];// clearing doc ids
      process.emit("lockIp", { ocrUrl: ipAddress, ipOcrLock: false, from: "IMC CONTROLLER" })
    }, 1000 * 1);
  });
};
const recentWebhookResponsesKvp = {}
/**
 * update document from ai
 * @param {*} payload
 * @param {*} hcb
 */
const updateDocumentOnRotationOcr = (request, hcb) => {
  const ipAddress = request.headers['x-real-ip'] || request.info.remoteAddress;
  const { payload } = request;
  // eslint-disable-next-line prefer-const
  let { data: ocrResponse = {}, doc_id: documentId, s3_link_final_output } = payload
  const deleteCellInfoPageData = []
  if (recentWebhookResponsesKvp.hasOwnProperty(payload.doc_id)) {
    console.log("FILE ALREADY OCR_COMPLETED", payload.doc_id)
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP | OCR |',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url: ipAddress,
        apiType: 'DOCUMENT_OCR WEBHOOK',
        error: "simultaneous load balancer response on KVP",
        documentId: payload.doc_id,
        message: "FILE ALREADY OCR COMPLETED",
        s3FilePathOriginal: `NA`
      }),
    }).then(() => { console.log("mail sent") }).catch(() => { })
    setTimeout(() => {
      process.emit("lockIp", { ocrUrl: ipAddress, ipOcrLock: false, from: "IMC CONTROLLER" })
    }, 1000 * 1)
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT });
  }
  recentWebhookResponsesKvp[payload.doc_id] = true;
  // let opType; let tenantId; let batchId;
  // setTimeout(() => {
  //   console.log("OCR RESPONSE AI SERVER after .1 overhead");
  //   process.emit("lockIp", { ocrUrl: ipAddress, ipOcrLock: false, from: "IMC CONTROLLER" })
  // }, 100);
  console.log('incoming payload OCR ROTATION', JSON.stringify(payload));
  const purgeS3Links = []
  const keyExtractResponseTime = new Date()
  let updatedPages = null
  auto({
    document: (cb) => {
      documentService.findOne({ _id: documentId }, null, { lean: true }, null, cb)
    },
    Pages: (cb) => {
      PAGE.find({ documentId }).sort({ pageNo: 1 }).lean().exec(cb)
    },
    aiExtractMaping: ['document', ({ document: file = null }, cb) => {
      if (!file) {
        return cb({ statusCode: 400, message: "document not valid" })
      }
      console.log("document.keyExtracted", file.keyExtracted)
      if (file.keyExtracted) {
        console.log("Document ALREADY keyExtracted")
        sendEmail({
          emails: "auqib@amygb.ai",
          subject: 'AI_BUGS | IDP | OCR |',
          body: JSON.stringify({
            environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
            url: ipAddress,
            apiType: 'DOCUMENT_OCR WEBHOOK',
            error: ocrResponse,
            documentId,
            message: "FILE ALREADY  keyExtraction COMPLETED",
            s3FilePathOriginal: `${file.s3Url}`
          }),
        }).then(() => { console.log("mail sent") }).catch(() => { })
        return cb(null, false)
      }
      if (ocrResponse.hasOwnProperty('error') && ocrResponse.error) {
        if (ocrResponse.error === '[AI]--OUTPUT_FAILURE' && ocrResponse.hasOwnProperty("errorCode") && ocrResponse.errorCode === 1) {
          ocrResponse = {
            ...ocrResponse,
            corruptFile: true
          }
        }
        sendEmail({
          apiTarget: 'OCR',
          subject: 'AI_BUGS | IDP | OCR',
          body: JSON.stringify({
            environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
            url: ipAddress,
            apiType: 'DOCUMENT_KEY_EXTRACT_WEBHOOK',
            error: ocrResponse,
            documentId,
            s3FilePathOriginal: `${file.s3Url}`
          }),
        }).then(() => { console.log("mail sent") }).catch(() => { })
      }

      ocrResponse = _customizeOcrResponse(ocrResponse);
      cb(null, ocrResponse)
    }],
    getDefaultContent: ['document', ({ document }, cb) => {
      DEFAULT_CONTENT({ documentType: document.docType, tenantId: document.tenantId }, cb)
    }],
    updateDocument: ['aiExtractMaping', 'Pages', 'getDefaultContent', ({ document, aiExtractMaping: ocrResponse, Pages, getDefaultContent }, cb) => {
      if (document.keyExtracted || !ocrResponse) {
        return cb(null, false)
      }
      if (Pages && Pages[0]) {
        document.pageArray = Pages
      }
      const { pageArray } = document
      let dataToSet = {};
      const pagesObject = {}
      if (ocrResponse.aiStatus === AI_STATUS.OCR_DONE) { // passed
        dataToSet.ocrClassification = "COMPLETED" // send for image rotater
        dataToSet.classification = "STARTED" // send for image rotater
        dataToSet.keyExtracted = false // send for image rotater
        pageArray.forEach((p, i) => {
          pagesObject[p.pageImageLink] = { ...p, pageNo: i + 1 } // assign pageNo as classfied order
        })
        pageArray.filter(e => e.page_type !== "#NEW_FORMAT#").forEach((p, i) => {
          let updatePageData = {}
          if (ocrResponse && ocrResponse.pageArray && ocrResponse.pageArray[i]) {
            updatePageData = ocrResponse.pageArray[i]
          }
          purgeS3Links.push(p.pageImageLink)
          purgeS3Links.push(p.s3_thumbnail_path)
          purgeS3Links.push(p.s3_ind_pdf_path)
          deleteCellInfoPageData.push(p.pageId)
          pagesObject[p.pageImageLink] = {
            ...p,
            ...updatePageData,
            pageId: p.pageId, // update existing page
            pageNo: pagesObject[p.pageImageLink].pageNo, // retain assigned pageNo as classfied order
            rotateByDegree: pagesObject[p.pageImageLink].rotateByDegree,
            sumRotateByDegree: pagesObject[p.pageImageLink].sumRotateByDegree, // retain total rotation sum
            ai_page_type: pagesObject[p.pageImageLink].ai_page_type, // retain total rotation sum
            ocrStrategyChanged: false
          }
        })
        // ocrResponse.pageArray.forEach(p => {
        //   console.log("pagesObject[p.pageImageLink]", pagesObject[p.pageImageLink])
        //   pagesObject[p.pageImageLink] = { ...p, pageNo: pagesObject[p.pageImageLink].pageNo, rotateByDegree: pagesObject[p.pageImageLink].rotateByDegree } // retain assigned pageNo as classfied order
        // })

        const sortedPageArray = Object.values(pagesObject).sort((a, b) => a.pageNo - b.pageNo)

        delete ocrResponse.s3DocumentPdfLink // accept pdf link from merge pdf api only

        dataToSet = { ...document, ...ocrResponse, ...dataToSet, pageArray: sortedPageArray }
      } else {
        dataToSet = {
          ocrClassification: "FAILED", // classification failed // send for image rotater
          classification: "STARTED", // send for image rotater
          keyExtracted: false // send for image rotater
        }
        dataToSet.pageArray = []
        document.pageArray.forEach((p, i) => { // move farward with 16 keys empty values
          if (i === 0) {
            p.nonTabularContent = getDefaultContent.nonTabularContent.map(e => ({ ...e, fieldId: createNewMongooseId() }))
            p.tabularContent = getDefaultContent.tabularContent
          } else {
            p.nonTabularContent = []
          }
          dataToSet.pageArray.push(p)
        })
      }
      // check if ocr done for document
      dataToSet.keyExtractResponseTime = keyExtractResponseTime
      dataToSet.s3_link_final_output = s3_link_final_output
      // dataToSet.ocrStrategyChanged = false
      // console.log("DATA TO SET ROTATION", JSON.stringify(dataToSet))
      dataToSet.aiStatus = AI_STATUS.OCR_DONE // retain ai status
      if (Pages && Pages[0]) {
        updatedPages = dataToSet.pageArray
        dataToSet.pageArray = []
      }
      delete dataToSet.docTotalPages // retain page count on update classification
      documentService.update({ _id: document._id }, { $set: dataToSet }, { new: true }, cb)
    }],
    delOldcellInfoMetaData: ['updateDocument', (_, cb) => {
      return cb();
      // deleteCellInfo(deleteCellInfoPageData, cb); // removed as page array is splitted
    }],
    updateDocPages: ["updateDocument", ({ document, Pages }, cb) => {
      console.log("DOC::::::::::::::::::::::::::::::::::::: updateDocPages on updateDocumentOnRotationOcr")
      if (!(Pages && Pages[0])) {
        return cb()
      }
      updatePages({ documentId: document._id, idpId: document.idpId, pageArray: updatedPages }, cb)
    }],
    checkPendingOcrReclassification: ['updateDocument', (_, cb) => {
      documentService.count({ ocrClassification: { $in: ['NOT_REQUIRED', 'PENDING'] } }, cb)
    }],
    updateBatchBackup: ['updateDocument', ({ document }, cb) => {
      IDP_BACKUP.findOneAndUpdate({ idpId: document.idpId }, { $addToSet: { purgeLinks: purgeS3Links } }, cb)
    }]
  }, (err, { document, checkPendingOcrReclassification }) => {
    if (err) {
      console.log("ERROR ON 405")
      hcb(err);
    } else {
      hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT });
    }
    console.log("PURGE lINKS", purgeS3Links)
    // if (document && document.ocrClassification === "IN_PROGRESS") { // server free check for rotated files
    console.log("document.ocrClassification", document.ocrClassification)
    console.log("checkPendingOcrReclassification", checkPendingOcrReclassification)
    console.log("process.env.KEY_VALUE_EXTRACT_OCR previous", process.env.KEY_VALUE_EXTRACT_OCR)
    if (checkPendingOcrReclassification) {
      process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED';
      process.env.KEY_VALUE_EXTRACT_OCR_LAST_ENABLED_AT = new Date()
    } else {
      process.env.KEY_VALUE_EXTRACT_OCR = 'DISABLED';
    }
    EMIT_EVENT("SUPER_ADMIN_REFRESH", { opType: "REFRESH", type: "SUPER_ADMIN_REFRESH" });
    payload['idpId'] = document && document.idpId
    payload['createdBy'] = `AI_WEBHOOK_KVP`;
    EMIT_EVENT('SAVE_LOG', { data: payload, from: 'RECEIVED_ON_WEBHOOK_FROM_AI_KVP' });
    setTimeout(() => {
      console.log("OCR RESPONSE AI SERVER after 1 seconds overhead,keyExtract");
      delete recentWebhookResponsesKvp[payload.doc_id];// clearing doc ids
      process.emit("lockIp", { ocrUrl: ipAddress, ipOcrLock: false, kvpNormal: document && document.ocrClassification === "WITHOUT_OCR_IN_PROGRESS", from: "IMC CONTROLLER keyExtract" })
    }, 1000 * 1);
    // }
    console.log("process.env.KEY_VALUE_EXTRACT_OCR next", process.env.KEY_VALUE_EXTRACT_OCR)
  });
};
const aiServerMapping = (request, hcb) => {
  auto({
    defaultConfig: (cb) => {
      ENV_CONFIG.findOne({}, (e, config) => {
        // console.log("defaultConfig", e, config)
        if (config && config.defaultServerMapping) {
          return cb(null, [config.defaultServerMapping])
        }
        return cb(null, [])
      })
    },
    mapping: (cb) => {
      const mapped = mappedAiServers()
      cb(null, mapped)
    }
  }, (e, { defaultConfig, mapping }) => {
    // let ai = [
    //   {
    //     aiServer: "10.13.0.8",
    //     coreOCRServer: "10.13.0.6",
    //     childServers: []
    //   }
    // ]
    const ai = defaultConfig.concat(mapping)
    // console.log("mappedAiServers", JSON.stringify(mapped))
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: ai });
  })
}

const updateDocumentVendor = (request, hcb) => {
  const { payload } = request;
  const documents = payload.documents || []
  let counter = 0
  if (!documents[0]) {
    return hcb({ statusCode: 400, message: "Minimum one document required" })
  }
  eachLimit(documents, 20, (document, cb) => {
    const { addressId = null, aiUniqueId = null } = document;
    if (!addressId || !aiUniqueId) {
      return cb()
    }
    counter++
    documentService.update({ aiUniqueId }, { $set: { addressId } }, cb)
  }, (err) => {
    if (err) {
      return hcb(err)
    }
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, message: `${counter} documents updated` });
  })
}

/**
 * Get mapped vendor list
 */
const fetchVendorList = (query = {}, hcb) => {
  console.log(query)
  const criteria = {}
  if (query.customerId) {
    criteria.customerId = query.customerId
  }
  auto({
    vendors: (cb) => {
      VENDOR_MAPPING.aggregate([
        { $match: criteria },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$addressId", doc: { $push: "$$ROOT" } } },
        {
          $replaceRoot: { newRoot: { $mergeObjects: [{ $arrayElemAt: ["$doc", 0] }, "$$ROOT"] } }
        },
        { $project: { doc: 0 } }
      ], cb)
    }
  }, (err, { vendors }) => {
    if (err) {
      return hcb(err)
    }
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: vendors })
  })
}


module.exports = {
  updateGlobalMapping,
  mappingFetchIMC,
  updateDemoOcr,
  fetchDemoOcr,
  fetchCredentials,
  userDeleteIMC,
  userUpdateIMC,
  updateDocumentOcr,
  updateDocumentOnRotationOcr,
  aiServerMapping,
  updateDocumentVendor,
  fetchVendorList
};
