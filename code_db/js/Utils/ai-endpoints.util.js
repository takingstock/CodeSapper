const config = require('config');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const PQueue = require('p-queue');
const { auto } = require('async');
const imcController = require('../Controllers/imc.controller');
const { sendEmail } = require('./imc-endpoints.util');
const { documentService } = require('../Services');
const AI_SERVER = require('../Models/ai-server-model');
const { waitForResponse, getLoadbalancerApi, checkServer, checkImmediateOcrRetry } = require('../Helpers/ai-endpoints')
const { readfile, newVendorListAddedAt } = require("./S3")
const { EMIT_EVENT } = require('./data-emitter.util');
const { discardServer, getPortAndIp, discardGeneralServer } = require("./load-balancer")

const OCR = config.get('OCR');
const OCR_APIS = OCR.APIS
const AXIOS_TIMEOUT = config.get('SERVER.AXIOS_TIMEOUT');
const OCR_UPLOAD_INPUT_KEY = config.get('OCR_UPLOAD_INPUT_KEY');
const QR_DENSITY = config.get('QR_DENSITY');
const AI_STATUS = config.get('AI_STATUS');
const SERVER_ENV = config.get('ENV');
const httpClient = axios.create();
httpClient.defaults.timeout = AXIOS_TIMEOUT;
httpClient.defaults.maxContentLength = Infinity
httpClient.defaults.maxBodyLength = Infinity

const ocrQueue = {}
let count = 0;
const listenQueueEvents = (queue, url) => {
  queue.on('active', () => {
    console.log(`PQUEUE PQUEUE Working on item #${++count}.  Size: ${queue.size}  Pending: ${queue.pending} aiserver: ${url}`);
  });
  queue.on('add', () => {
    console.log(`PQUEUE PQUEUE Task is added.  Size: ${queue.size}  Pending: ${queue.pending} aiserver: ${url}`);
  });
  queue.on('next', () => {
    console.log(`PQUEUE PQUEUE Task is completed.  Size: ${queue.size}  Pending: ${queue.pending} aiserver: ${url}`);
  });
  queue.on('idle', () => {
    console.log(`Queue is idle.  Size: ${queue.size}  Pending: ${queue.pending} aiserver: ${url}`);
  });
  queue.on('error', error => {
    console.error(`QUEUE:  aiserver: ${url}`, error);
  });
}
const _aiServer = (documentId, serverType) => new Promise((resolve) => {
  auto({
    document: (cb) => {
      documentService.findOne({ _id: documentId }, { configId: 1 }, null, [{ path: 'configId', fields: 'aiServerId' }], cb);
    },
    aiServer: ['document', ({ document }, cb) => {
      if (!document || !document.configId || !document.configId.aiServerId) {
        return cb(null, null);
      }
      const aiServerId = document.configId.aiServerId;
      AI_SERVER.findOne({ _id: aiServerId }, cb);
    }]
  }, (err, { aiServer }) => {
    if (err || !aiServer) {
      resolve(false);
    } else {
      resolve(aiServer[serverType]);
    }
  });
});
const _fetchOcr = async (url, formData, headers, documentId, priority = 3) => {
  return httpClient.post(url, formData, headers);
  // if (!ocrQueue[url]) {
  //   ocrQueue[url] = new PQueue({
  //     concurrency: 1,
  //     timeout: 6 * 60 * 1000 // 6 minutes
  //   });
  //   listenQueueEvents(ocrQueue[url], url);
  // }
  // return ocrQueue[url].add(() => httpClient.post(url, formData, headers), { priority });
}
const updateDocStatus = (criteria, update, options = {}) => new Promise((resolve, reject) => {
  documentService.update(criteria, update, options, (err, data) => {
    if (err) {
      return reject(err)
    }
    return resolve(data)
  })
})
let ipOcrLock = {
}
process.on("lockIp", (data) => {
  // console.log("lockIp EVENT listened in ai ENdpoints", data)
  ipOcrLock = data.ipOcrLock
  if (!data.ipOcrLock && !data.kvpNormal) {
    Object.keys(ipOcrLock).forEach(k => {
      ipOcrLock[k] = false
    })
  }
})

/**
 * process training document AI
 * @param {string} path
 * @param {string} tenantId
 * @param {string} documentId
 * @param {string} isTraining
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const processOcr = ({ path, tenantId, documentId, docName, processOcrUpload = false, ocrServer = null, externalCustomerId = null, external = {}, splitFilePageRange, uploadedDocType }) => new Promise(
  // const processOcr = (path, tenantId, documentId, docName, processOcrUpload = false, ocrServer = null, externalCustomerId = null, splitFilePageRange) => new Promise(
  async (resolve, reject) => {
    let ocrUrl
    let filePath
    let s3
    const payload = {
      tenantId,
      doc_id: documentId,
      doc_name: docName,
    }
    try {
      const formData = new FormData();
      if (process.env.NODE_ENV !== SERVER_ENV.TEST
        && process.env.NODE_ENV !== SERVER_ENV.DEMO) {
        formData.append('customer_id', tenantId.toString());
        if (externalCustomerId) {
          payload.client_customer_id = externalCustomerId
          formData.append('client_customer_id', externalCustomerId.toString());
        }
        if (external && external.headers && external.headers.length) {
          payload.table_columns = external.headers.map(c => c.trim())
          formData.append('table_columns', JSON.stringify(payload.table_columns));
        }
        formData.append('doc_id', documentId.toString());
        formData.append('doc_name', docName);
        formData.append('document_type', uploadedDocType);
        const fileDetails = await readfile({ s3path: path, downloadFromS3: true, docType: uploadedDocType });
        if (fileDetails.timeStampVendorListUpdated) {
          payload.timestamp = fileDetails.timeStampVendorListUpdated
          formData.append('timestamp', `${new Date(fileDetails.timeStampVendorListUpdated)}`);
        }
        if (splitFilePageRange) {
          payload.start_page = splitFilePageRange.split('____')[0]
          payload.end_page = splitFilePageRange.split('____')[1]
          formData.append('start_page', splitFilePageRange.split('____')[0]);
          formData.append('end_page', splitFilePageRange.split('____')[1]);
        }
        if (process.env.S3_ENABLED === 'true') {
          payload.s3_url_file = path
          formData.append("s3_url_file", path);
        } else {
          payload.file_path = path
          formData.append(OCR_UPLOAD_INPUT_KEY, fs.createReadStream(path));
        }
        if (process.env.OCR_PROCESS_TYPE) {
          formData.append('process', process.env.OCR_PROCESS_TYPE);
        }
        const headers = { ...formData.getHeaders() };
        const url = OCR_APIS.DOCUMENT_OCR;
        let priority = 2
        if (processOcrUpload) {
          priority = 10
        }
        ocrUrl = ocrServer || (await _aiServer(documentId, 'documentOcr')) || url
        const ocrRequestTime = new Date();
        if (ipOcrLock[ocrUrl]) {
          console.log("can't proceed with ip", ocrUrl)
          // process.emit("lockIp", { ocrUrl, ipOcrLock: true, from: "processOcr :152 ai enpoints controller" })
          return resolve({ wait: true });
        }
        const newPayload = {
          ocrRequestTime,
          aiStatus: AI_STATUS.OCR_INPROGRESS,
          ocrUrl,
          idpId: null,
          documentId
        }
        // newPayload.idpId = document && document.idpId
        await updateDocStatus({ _id: documentId }, { $set: { ocrRequestTime, ocrUrl, aiStatus: AI_STATUS.OCR_INPROGRESS } })
        newPayload['createdBy'] = 'OCR_SENT_AI';
        EMIT_EVENT('SAVE_LOG', { data: newPayload, from: 'SENT_TO_AI_FOR_OCR_PROCESSING' });
        payload.ocrUrl = ocrUrl
        console.log("SENT OCR REQUEST:", payload)
        const { data } = await _fetchOcr(ocrUrl, formData, { headers }, documentId, priority);
        console.log("RECIEVED OCR RESPONSE IN ", ocrUrl, documentId, new Date() - ocrRequestTime)
        console.log("OCR RESPONSE: ", ocrUrl, JSON.stringify(data))
        const orcrData = data || {};
        if (orcrData.hasOwnProperty('processStart')) {
          if (orcrData.processStart === 'FAILURE') {
            if (orcrData.errorCode === 54) {
              orcrData.wait = true;
              process.emit("lockIp", { ocrUrl, ipOcrLock: true, from: "processOCr :188 ai server busy" })
              await updateDocStatus({ _id: documentId }, { $set: { aiStatus: AI_STATUS.OCR_PENDING } })
            } else {
              orcrData.wait = await checkImmediateOcrRetry({ documentId })
              process.emit("lockIp", { ocrUrl, ipOcrLock: false, from: `processOCr FREE DUE TO AI ERROR: ${orcrData.error} ` })
            }
            sendEmail({
              apiTarget: 'OCR',
              subject: 'AI_BUGS | IDP | OCR',
              body: JSON.stringify({
                environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
                url: ocrUrl,
                apiType: 'DOCUMENT_OCR',
                response: orcrData,
                payload,
                immedate: true,
                fileOrignalPath: path,
                filePath: s3,
              }),
            }).then(() => { }).catch(() => { })
          } else if (orcrData.processStart === 'SUCCESS') {
            console.log("ready to emit lockIp event", ocrUrl)
            ipOcrLock[ocrUrl] = true
            const dataToSet = { totalPages: orcrData.totalPages }
            process.emit("lockIp", { ocrUrl, ipOcrLock: true, from: "processOCr :189 ai enpoints controller" })
            if (!splitFilePageRange && process.env.FILE_PAGES_ON_SERVER_LIMIT_THRESHOLD && orcrData.totalPages > process.env.FILE_PAGES_ON_SERVER_LIMIT_THRESHOLD) {
              dataToSet.splitFileOcr = true
              const { ip } = getPortAndIp(ocrUrl)
              EMIT_EVENT('SPLIT_FILE', { data: { documentId, totalPages: orcrData.totalPages, ip } });
            } else {
              waitForResponse(payload, orcrData, path, ocrUrl)
            }
            await updateDocStatus({ _id: documentId }, { $set: dataToSet })
            return resolve({ ...orcrData, wait: true });
          }
        }
        return resolve(orcrData);
      }
      // console.log("Iam outside",docName)
      imcController.fetchDemoOcr((_, DEMO_MOCK_JSON = {}) => {
        // console.log("Iam outside",docName)

        const orcrData = DEMO_MOCK_JSON.hasOwnProperty(docName.toString())
          ? DEMO_MOCK_JSON[docName.toString()]
          : {};
        orcrData.customer_id = tenantId;
        // console.log("Data fetched Iam outside")
        return resolve(orcrData);
      });
      // const DEMO_MOCK_JSON = {};
    } catch (err) {
      // send emails to AI team in case of errors or API failed
      console.log("AIOCR ERROR", err)
      if (err.code === 'EPIPE') {
        process.emit("lockIp", { ocrUrl, ipOcrLock: true, from: "processOCr :EPIPE EROR ai server busy" })
        await updateDocStatus({ _id: documentId }, { $set: { aiStatus: AI_STATUS.OCR_PENDING } })
        setTimeout(() => {
          console.log("WAIT TIME EPIPE EXCEEDS")
          process.emit("lockIp", { ocrUrl, ipOcrLock: false, from: "processOCr :EPIPE WAITING ai server busy" })
        }, 1000 * 60)
        return resolve({ wait: true })
      }
      sendEmail({
        apiTarget: 'OCR',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: ocrUrl,
          apiType: 'OCR',
          payload,
          error: err.message,
          filePath: s3
        }),
      }).then(() => { }).catch(() => { });
      if (err && err.message && (err.message.includes("ECONNREFUSED") || err.message.includes("ECONNRESET") || err.message.includes("socket hang up"))) {
        const { ip } = getPortAndIp(ocrUrl)
        discardServer(ip)
        await updateDocStatus({ _id: documentId }, { $set: { aiStatus: AI_STATUS.OCR_PENDING } })
        return resolve({ wait: true })
      }
      return reject(new Error(err.message));
    }
  },
);

/**
 * process training document AI
 * @param {string} path
 * @param {string} tenantId
 * @param {string} documentId
 * @param {string} isTraining
 * @returns
 */
const processBucketing = async (_, payload = {}) => new Promise(
  // eslint-disable-next-line no-async-promise-executor
  async (resolve, reject) => {
    try {
      const url = OCR_APIS.DOCUMENT_BUCKETING;
      const documentId = payload.processed_docs[0] && payload.processed_docs[0].doc_id
      let bucketingUrl = url;
      if (documentId) {
        bucketingUrl = (await _aiServer(documentId, 'documentBucketing')) || url;
      }
      console.log("BUCKETING API REQUEST", JSON.stringify(payload))
      const { data } = await httpClient.post(bucketingUrl, payload);
      console.log("BUCKETING API RESPONSE", JSON.stringify(data))
      return resolve(data);
    } catch (err) {
      // send emails to AI team in case of errors or API failed
      sendEmail({
        apiTarget: 'FEEDBACK',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: OCR_APIS.DOCUMENT_BUCKETING,
          apiType: 'DOCUMENT_BUCKETING',
          payload,
          error: err.message,
        }),
      }).then(() => { }).catch(() => { });
      return reject(new Error(err.message));
    }
  },
);

/**
 * give user-feedbak to AI
 * @param {Object} payload
 * @param {object} "user_feedback"
 * @param {string} "document_category"
 * @param {string} "ocr_link"
 * @param {Array} "global_keys_in_document_caterory"
 * @returns
 */
const processNonTabularTraining = async (payload) => new Promise(
  // eslint-disable-next-line no-async-promise-executor
  async (resolve, reject) => {
    try {
      const url = (await _aiServer(payload.file.doc_id, 'nonTabularFeedback')) || OCR_APIS.NON_TABULAR_FEEDBACK;
      console.log("NON TABULAR FEEDBACK URL: ", url)
      const { data } = await httpClient.post(url, payload);
      return resolve(data);
    } catch (err) {
      // send emails to AI team in case of errors or API failed
      sendEmail({
        apiTarget: 'FEEDBACK',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: OCR_APIS.NON_TABULAR_FEEDBACK,
          apiType: 'NON_TABULAR_FEEDBACK',
          payload,
          error: err.message,
        }),
      }).then(() => { }).catch(() => { });
      return reject(new Error(err.message));
    }
  },
);

/**
   * give user-feedbak to AI
   * @param {Object} payload
   * @returns
   */
const processTabularTraining = async (payload) => new Promise(
  // eslint-disable-next-line no-async-promise-executor
  async (resolve, reject) => {
    try {
      const url = (await _aiServer(payload.file.doc_id, 'tabularFeedback')) || OCR_APIS.TABULAR_FEEDBACK;
      console.log("TABULAR FEEDBACK URL: ", url)
      const { data } = await httpClient.post(url, payload);
      return resolve(data);
    } catch (err) {
      // send emails to AI team in case of errors or API failed
      sendEmail({
        apiTarget: 'FEEDBACK',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: OCR_APIS.TABULAR_FEEDBACK,
          apiType: 'TABULAR_FEEDBACK',
          payload,
          error: err.message,
        }),
      }).then(() => { }).catch(() => { });
      return reject(new Error(err.message));
    }
  },
);

/**
 * give user-feedbak to AI
 * @param {Object} payload
 * @param {string} s3Link
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const processDocumentSnipplet = (payload) => new Promise(async (resolve, reject) => {
  let url = process.env.SNIPPET_API || OCR_APIS.DOCUMENT_SNIPPLET;
  try {
    console.log("SNIPET URL before", url)
    url = getLoadbalancerApi('SNIPPET', url)
    console.log("SNIPET URL", url)
    const { data } = await httpClient.get(url, { params: payload, transformResponse: null });
    console.log("SNIPET DATA RESPONSE,", data)
    return resolve(data);
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    if (process.env.SERVER_MAPPING !== "DISABLED") {
      if (err.message === "Server in maintenance") {
        url = null
        err.message = "All AI server down for snipet api"
      } else {
        const { ip, port } = getPortAndIp(url)
        discardGeneralServer({ ip, port, serverType: "SNIPPET" })
      }
    }
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url,
        apiType: 'SNIPPET',
        payload,
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return reject(err);
  }
});

/**
 * process training document AI
 * @param {string} path
 * @param {string} _tenantId
 * @param {string} _documentId
 * @param {string} isTraining
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const processQr = async (path) => new Promise(async (resolve) => {
  try {
    const formData = new FormData();
    formData.append(OCR_UPLOAD_INPUT_KEY, fs.createReadStream(path));
    formData.append('density_json', JSON.stringify(QR_DENSITY));
    const headers = { ...formData.getHeaders() };
    const url = OCR_APIS.DOCUMENT_QR;
    const { data } = await httpClient.post(url, formData, { headers });
    const { response = [] } = data;
    const mappedResponse = response.map((item) => {
      const {
        page_array = {}, qr_response = {},
      } = item;
      return {
        dimension: page_array.dimension,
        page: (page_array.page + 1),
        s3_path: page_array.s3_path,
        QR: qr_response.QR || null,
        QR_DETECTED: qr_response.QR_DETECTED || false,
        status: qr_response.QR_DETECTED ? AI_STATUS.QR_DONE : AI_STATUS.QR_NOT_FOUND,
      };
    });
    return resolve({
      data: mappedResponse,
    });
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url: OCR_APIS.DOCUMENT_QR,
        apiType: 'OCR_QR',
        payload: {
          density_json: QR_DENSITY,
        },
        error: err.message,
      }),
      filePath: path,
    }).then(() => { }).catch(() => { });
    return resolve({
      data: [{
        page: 1,
        status: AI_STATUS.QR_FAILED,
      }],
    });
  }
});

/**
 * provide OCR server health to AI
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const fetchOcrHealthStatus = async () => new Promise(async (resolve) => {
  try {
    const url = OCR_APIS.HEALTH_OCR;
    const { data } = await httpClient.get(url);
    return resolve({
      status: !!data.response,
    });
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url: OCR_APIS.HEALTH_OCR,
        apiType: 'OCR_HEALTH',
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return resolve({
      status: false,
    });
  }
});

/**
 * provide QR server health to AI
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const fetchQrHealthStatus = async () => new Promise(async (resolve) => {
  try {
    const url = OCR_APIS.HEALTH_QR;
    const { data } = await httpClient.get(url);
    return resolve({
      status: !!data.response,
    });
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url: OCR_APIS.HEALTH_QR,
        apiType: 'QR_HEALTH',
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return resolve({
      status: false,
    });
  }
});

/**
 * provide feedback server health to AI
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const fetchOcrFeedbackStatus = async () => new Promise(async (resolve) => {
  try {
    const url = OCR_APIS.HEALTH_FEEDBACK;
    await httpClient.post(url);
    return resolve({
      status: true,
    });
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    sendEmail({
      apiTarget: 'FEEDBACK',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url: OCR_APIS.HEALTH_FEEDBACK,
        apiType: 'FEEDBACK_HEALTH',
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return resolve({
      status: false,
    });
  }
});

/**
 * provide feedback server health to AI
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const fetchBucketizationStatus = async () => new Promise(async (resolve) => {
  try {
    const url = OCR_APIS.HEALTH_DOCUMENT_BUCKETING;
    await httpClient.post(url);
    return resolve({
      status: true,
    });
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    sendEmail({
      apiTarget: 'FEEDBACK',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url: OCR_APIS.HEALTH_DOCUMENT_BUCKETING,
        apiType: 'BUCKET_HEALTH',
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return resolve({
      status: false,
    });
  }
});

// eslint-disable-next-line no-async-promise-executor
const ocrValidateLogics = async () => new Promise(async (resolve) => {
  try {
    return resolve(true);
  } catch (err) {
    return resolve(false);
  }
});

/**
 * update Flags to AI
 * @param {Object} payload { doc_id, table_flag, non_table_flag, ocr_output_path }
 * @returns
 */
const updateFlags = async (payload) => new Promise(
  // eslint-disable-next-line no-async-promise-executor
  async (resolve, reject) => {
    const { documentId, nonTableFlag = true, tableFlag = true, ocrOutputLink = null } = payload
    if (!ocrOutputLink) {
      return resolve({ data: { updated: false } })
    }
    let URL = OCR_APIS.UPDATE_FLAGS;
    try {
      const formData = new FormData();
      // formData.append('doc_id', documentId.toString());
      formData.append('ocr_output_path', ocrOutputLink);
      formData.append('non_table_flag', nonTableFlag.toString());
      formData.append('table_flag', tableFlag.toString());
      URL = (await _aiServer(documentId, 'updateFlags')) || OCR_APIS.UPDATE_FLAGS;
      console.log("UPDATE FLAGS Reques: ", formData);
      const headers = { ...formData.getHeaders() };
      const response = await httpClient.post(URL, formData, { headers });
      console.log("UPDATE FLAGS ResPonse: ", response.data);
      return resolve(response);
    } catch (err) {
      // send emails to AI team in case of errors or API failed
      sendEmail({
        apiTarget: 'UPDATE FLAGS',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: URL,
          apiType: 'UPDATE_FLAGS',
          payload,
          error: err.message,
        }),
      }).then(() => { }).catch(() => { });
      return reject(new Error(err.message));
    }
  },
);

/**
 * @param {*} payload
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const processVendorCorrection = (payload) => new Promise(async (resolve, reject) => {
  const url = process.env.VENDOR_CORRECTION_API || OCR_APIS.VENDOR_CORRECTION;
  try {
    const { data } = await httpClient.get(url);
    return resolve(data);
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url,
        apiType: 'VENDOR_CORRECTION',
        payload,
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return reject(err);
  }
});

const processKeyValueExtract = (document, url = null) => new Promise(
  async (resolve, reject) => {
    const { pageArray, fileOriginalName: doc_name, _id: documentId, externalCustomerId, external = {}, tenantId, docType } = document
    const idpId = document.idpId
    let keyValueExtractUrl = url || process.env.KEY_VALUE_EXTRACT_URL
    const payload = { documentId, doc_name, keyValueExtractUrl, customer_id: tenantId, docType, document_type_input: document.uploadedDocType }
    try {
      const formData = new FormData();
      payload.images = []
      payload.s3PathOcr = []
      payload.s3PathStiched = []
      payload.thumbnail_image_list = []
      payload.rotate = []
      payload.strategy_list = []
      payload.s3_pdf_list = []
      // payload.sd_to_inv = []
      payload.absolute_rotate = []
      pageArray.forEach(page => {
        payload.images.push(page.pageImageLink)
        payload.s3PathOcr.push(page.s3_path_ocr)
        payload.s3PathStiched.push(page.s3_path_ocr_stitched)
        payload.rotate.push(page.rotateByDegree || 0)
        // TODO uncomment
        /* 3 new keys for ocr strategy start */
        payload.strategy_list.push((page.ocrStrategyChanged && page.ocrStrategy[0]) || "")
        payload.s3_pdf_list.push(page.s3_ind_pdf_path || "")
        payload.absolute_rotate.push(page.sumRotateByDegree || 0)
        // payload.sd_to_inv.push(page.ai_page_type !== page.page_type)
        /* 3 new keys for ocr strategy end */
        if (page.s3_thumbnail_path) {
          payload.thumbnail_image_list.push(page.s3_thumbnail_path)
        }
      })
      formData.append('s3_image_list', JSON.stringify(payload.images));
      formData.append('s3_raw_ocr_list', JSON.stringify(payload.s3PathOcr))
      formData.append('s3_ocr_list', JSON.stringify(payload.s3PathStiched))
      formData.append('doc_id', documentId.toString());
      formData.append('rotate', JSON.stringify(payload.rotate));
      formData.append('customer_id', tenantId.toString());
      formData.append('document_type', docType);
      formData.append('document_type_input', document.uploadedDocType);

      // if (payload.sd_to_inv && payload.sd_to_inv.includes(true)) {
      //   console.log("sd to in added")
      //   formData.append('sd_to_inv', JSON.stringify(payload.sd_to_inv))
      // }
      // TODO uncomment
      /* 3 new keys for ocr strategy start */
      if (payload.strategy_list.length && payload.s3_pdf_list.length && payload.absolute_rotate.length) {
        formData.append('strategy_list', JSON.stringify(payload.strategy_list));
        formData.append('s3_pdf_list', JSON.stringify(payload.s3_pdf_list));
        formData.append('absolute_rotate', JSON.stringify(payload.absolute_rotate));
      }
      /* 3 new keys for ocr strategy start */
      if (payload.thumbnail_image_list.length === payload.images.length) {
        formData.append('thumbnail_image_list', JSON.stringify(payload.thumbnail_image_list))
      } else {
        formData.append('thumbnail_image_list', JSON.stringify([]))
      }
      formData.append('doc_name', doc_name);
      if (externalCustomerId) {
        formData.append('client_customer_id', externalCustomerId.toString());
      }
      if (external && external.headers && external.headers.length) {
        payload.table_columns = external.headers.map(c => c.trim())
        formData.append('table_columns', JSON.stringify(payload.table_columns));
      }
      if (process.env.OCR_PROCESS_TYPE) {
        formData.append('process', process.env.OCR_PROCESS_TYPE);
      }
      const headers = { ...formData.getHeaders() };
      if (!url) {
        keyValueExtractUrl = getLoadbalancerApi('KEY_VALUE', keyValueExtractUrl)
        const server = await checkServer('KEY_VALUE', keyValueExtractUrl);
        if (server.wait) {
          return resolve({ wait: true })
        }
      }
      const fileDetails = await newVendorListAddedAt({ docType });
      if (fileDetails && fileDetails.timeStampVendorListUpdated) {
        formData.append('timestamp', `${new Date(fileDetails.timeStampVendorListUpdated)}`);
        payload.timeStamp = fileDetails.timeStampVendorListUpdated
      }
      payload.keyValueExtractUrl = keyValueExtractUrl
      const newPayload = payload
      newPayload[idpId] = idpId
      newPayload['createdBy'] = 'KVP_SENT_AI';
      EMIT_EVENT('SAVE_LOG', { data: newPayload, from: 'SENT_TO_AI_FOR_KVP_PROCESSING' });
      console.log("request sent on KEY_VALUE_EXTRACT: ", payload && payload.images && payload.images.length)
      await updateDocStatus({ _id: documentId }, { $set: { ocrUrl: keyValueExtractUrl, keyExtractRequestTime: new Date() } })
      const response = await httpClient.post(keyValueExtractUrl, formData, { headers });
      console.log("response KEY_VALUE_EXTRACT", response.data)

      const { data: ocrData } = response
      if (ocrData.processStart === 'FAILURE') {
        // send emails to AI team in case of errors or API failed
        sendEmail({
          apiTarget: 'OCR',
          subject: 'AI_BUGS | IDP',
          body: JSON.stringify({
            environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
            url: keyValueExtractUrl,
            apiType: 'KEY_VALUE_EXTRACT',
            response: ocrData,
            payload
          }),
        }).then(() => { }).catch(() => { })
        if (ocrData.errorCode === 54) {
          return resolve({ wait: true, errorCode: 54 })
        }
        reject(ocrData);
      } else if (ocrData.processStart === 'SUCCESS') {
        // console.log("ready to emit lockIp event", ocrUrl)
        // ipOcrLock[ocrUrl] = true
        // process.emit("lockIp", { ocrUrl, ipOcrLock: true, from: "processOCr :189 ai enpoints controller" })
        // documentService.updateAll({ _id: documentId }, { $set: { totalPages: ocrData.totalPages } }, null, () => { })
        return resolve({ ...ocrData, wait: true });
      }
      return resolve(ocrData);
    } catch (err) {
      console.log("ERROR processKeyValueExtract", err)
      if (process.env.SERVER_MAPPING !== "DISABLED") {
        if (err.message === "Server in maintenance") {
          keyValueExtractUrl = null
          err.message = "All AI servers down for key value extract api"
        }
      }
      sendEmail({
        apiTarget: 'OCR',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: keyValueExtractUrl,
          apiType: 'KEY_VALUE_EXTRACT',
          payload,
          error: err.message || err
        })
      }).then(() => { }).catch(() => { });
      if (err && err.message && (err.message.includes("ECONNREFUSED") || err.message.includes("ECONNRESET") || err.message.includes("socket hang up"))) {
        const { ip } = getPortAndIp(keyValueExtractUrl)
        discardServer(ip)
        return resolve({ wait: true, errorCode: 54, revert: true })
      }
      return reject(err);
    }
  }
)

const generatePdf = (document) => new Promise(
  async (resolve, reject) => {
    const { pageArray, fileOriginalName: doc_name, _id: documentId, fileName, s3Url } = document
    const idpId = document.idpId
    let pdfGeneratorUrl = process.env.MERGE_PDF
    const payload = { documentId, doc_name, pdfGeneratorUrl }
    try {
      // const extension = PATH.extname(fileName) || '.pdf'
      // payload.output_extension = extension.slice(1)
      const formData = new FormData();
      payload.all_image_list = []
      // payload.pageNos = []
      payload.rotate = []
      // payload.s3_link_pdf = s3Url
      payload.pdf_list = []
      if (pageArray && pageArray.length) {
        pageArray.forEach(page => {
          payload.all_image_list.push(page.pageImageLink)
          payload.rotate.push(page.sumRotateByDegree || 0)
          payload.pdf_list.push(page.s3_ind_pdf_path)
          // if (page.pageImageLink) {
          //   const url = page.pageImageLink.split('-')
          //   payload.pageNos.push(url[url.length - 1].split(".")[0])
          // }
        })
        formData.append('image_list', JSON.stringify(payload.all_image_list));
        formData.append('doc_name', `${documentId}`);
        // formData.append('output_extension', payload.output_extension);
        formData.append('rotate', JSON.stringify(payload.rotate));
        formData.append('pdf_list', JSON.stringify(payload.pdf_list));
        /**
         * new changes
         */
        // const ext = extension.slice(1)

        // if (ext.toLowerCase() === 'pdf' || ext.toLowerCase() === 'tif' || ext.toLowerCase() === 'tiff') {
        //   payload.pageNos = payload.pageNos.sort((a, b) => a - b)
        //   // eslint-disable-next-line no-restricted-globals
        //   payload.startPage = `${payload.pageNos[0]}`
        //   // eslint-disable-next-line no-restricted-globals
        //   payload.endPage = `${payload.pageNos[payload.pageNos.length - 1]}`
        // } else {
        //   payload.startPage = `0`
        //   payload.endPage = `0`
        // }
        // formData.append('s3_link_pdf', s3Url);
        // formData.append('start_page', payload.startPage);
        // formData.append('end_page', payload.endPage);
        const headers = { ...formData.getHeaders() };
        pdfGeneratorUrl = getLoadbalancerApi('PDF_GENERATOR', pdfGeneratorUrl)
        const server = await checkServer('PDF_GENERATOR', pdfGeneratorUrl);
        if (server.wait) {
          return resolve({ wait: true })
        }
        payload.pdfGeneratorUrl = pdfGeneratorUrl
        console.log("request sent on PDF_GENERTOR: ", payload)
        const defaultTimeOut = 1000 * 60 * 5;
        const timeOutFile = 1000 * 5 * payload.all_image_list.length // 70
        const finalTimeOut = timeOutFile > defaultTimeOut ? timeOutFile : defaultTimeOut
        console.log("defaultTimeOut: ", defaultTimeOut)
        console.log("timeOutFile: ", timeOutFile)
        console.log("finalTimeOut: ", finalTimeOut)
        const newPayload = payload
        newPayload[idpId] = idpId
        newPayload['createdBy'] = 'BY_SYSTEM';
        EMIT_EVENT('SAVE_LOG', { data: newPayload, from: 'PDF_GENERATED_BY_SYSTEM' });
        const response = await httpClient.post(pdfGeneratorUrl, formData, { timeout: finalTimeOut, headers });
        console.log("response PDF_GENERTOR", response.data)
        const { data: ocrData } = response
        if (ocrData.processStart === 'FAILURE') {
          // send emails to AI team in case of errors or API failed
          if (ocrData.errorCode === 54) {
            return resolve({ wait: true })
          }
          sendEmail({
            apiTarget: 'OCR',
            subject: 'AI_BUGS | IDP',
            body: JSON.stringify({
              environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
              url: pdfGeneratorUrl,
              apiType: 'GENERATE_PDF',
              response: ocrData,
              payload
            }),
          }).then(() => { }).catch(() => { })
          return resolve(ocrData);
        }
        return resolve(ocrData);
      }
      sendEmail({
        emails: "shahab@amygb.ai, auqib@amygb.ai, farha@amygb.ai",
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: pdfGeneratorUrl,
          apiType: 'GENERATE_PDF',
          document: JSON.stringify(document)
        })
      }).then(() => { }).catch(() => { });
      return resolve(null)
    } catch (err) {
      if (process.env.SERVER_MAPPING !== "DISABLED") {
        if (err.message === "Server in maintenance") {
          pdfGeneratorUrl = null
          err.message = "All AI servers down for pdf generator api"
        }
      }
      console.log("ERROR generatePdf: ", err)
      sendEmail({
        apiTarget: 'OCR',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: pdfGeneratorUrl,
          apiType: 'GENERATE_PDF',
          payload,
          error: err.message
        })
      }).then(() => { }).catch(() => { });
      return reject(err);
    }
  }
)

const rotateImages = (document) => new Promise(
  async (resolve, reject) => {
    const { pageArray, fileOriginalName: doc_name, _id: documentId } = document
    const idpId = document.idpId
    let rotateImagesUrl = process.env.ROTATE_IMG_URL
    const payload = { documentId, doc_name, rotateImagesUrl }
    try {
      const formData = new FormData();
      payload.rotate = []
      payload.s3_link_jpg_list = []
      payload.s3_thumbnail_images = [] // TODO
      if (pageArray && pageArray.length) {
        pageArray.forEach(page => {
          payload.s3_link_jpg_list.push(page.pageImageLink)
          payload.rotate.push(page.rotateByDegree || 0)
          payload.s3_thumbnail_images.push(page.s3_thumbnail_path) // cover images
          // payload.rotate.push(page.rotateByDegree || 0) // cover images
        })
        if (payload.s3_thumbnail_images.length) {
          payload.s3_link_jpg_list = payload.s3_link_jpg_list.concat(payload.s3_thumbnail_images)
          payload.rotate = payload.rotate.concat(payload.rotate)
        }
        delete payload.s3_thumbnail_images
        formData.append('s3_link_jpg_list', JSON.stringify(payload.s3_link_jpg_list));
        formData.append('rotate', JSON.stringify(payload.rotate));
        const headers = { ...formData.getHeaders() };
        rotateImagesUrl = getLoadbalancerApi('IMAGE_ROTATOR', rotateImagesUrl)
        const server = await checkServer('IMAGE_ROTATOR', rotateImagesUrl);
        if (server.wait) {
          return resolve({ wait: true })
        }
        payload.rotateImagesUrl = rotateImagesUrl
        console.log("request sent on ROTATE_IMG_URL: ", payload)
        const newPayload = payload
        newPayload[idpId] = idpId
        // TODO : CHECK
        // newPayload['createdBy'] = 'USER';
        EMIT_EVENT('SAVE_LOG', { data: newPayload, from: 'ROTATE_IMAGES' });
        const response = await httpClient.post(rotateImagesUrl, formData, { headers });
        console.log("response ROTATE_IMG_URL", response.data)
        const { data: ocrData } = response
        if (ocrData.processStart === 'FAILURE') {
          // send emails to AI team in case of errors or API failed
          if (ocrData.errorCode === 54) {
            return resolve({ wait: true })
          }
          sendEmail({
            apiTarget: 'OCR',
            subject: 'AI_BUGS | IDP',
            body: JSON.stringify({
              environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
              url: rotateImagesUrl,
              apiType: 'ROTATE_IMG',
              response: ocrData,
              payload
            }),
          }).then(() => { }).catch(() => { })
          return resolve(ocrData);
        }
        return resolve(ocrData);
      }
      sendEmail({
        emails: "shahab@amygb.ai, auqib@amygb.ai, farha@amygb.ai",
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: rotateImagesUrl,
          apiType: 'ROTATE_IMG',
          document: JSON.stringify(document)
        })
      }).then(() => { }).catch(() => { });
      return resolve(null)
    } catch (err) {
      if (process.env.SERVER_MAPPING !== "DISABLED") {
        if (err.message === "Server in maintenance") {
          rotateImagesUrl = null
          err.message = "All AI servers down for rotate image api"
        }
      }
      console.log("ERROR ROTATE_IMG_URL: ", err)
      sendEmail({
        apiTarget: 'OCR',
        subject: 'AI_BUGS | IDP',
        body: JSON.stringify({
          environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
          url: rotateImagesUrl,
          apiType: 'ROTATE_IMG',
          payload,
          error: err.message
        })
      }).then(() => { }).catch(() => { });
      return reject(err);
    }
  }
)

/**
 * processTableCompletion
 * @param {*} payload
 * @returns
 */
const processTableCompletion = (payload) => new Promise(async (resolve, reject) => {
  let url = process.env.TABLE_COMPLETION_API
  let requestTime = null
  try {
    console.log("table completion URL before", url)
    url = getLoadbalancerApi('TABLE_COMPLETION', url)
    console.log("table completion URL", url)
    const formData = new FormData();
    // const response = await httpClient.get(url, { params: payload });
    for (const key in payload) {
      const value = typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : payload[key];
      formData.append(key, value);
    }
    const headers = { ...formData.getHeaders() };
    requestTime = new Date()
    const response = await httpClient.post(url, formData, { headers });
    console.log("table completion response", response.data)
    EMIT_EVENT('SAVE_AI_API_LOGS', { response: response.data, payload, url, apiType: 'TABLE_COMPLETION_API', requestTime, responseTime: new Date() });
    return resolve(response.data);
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    EMIT_EVENT('SAVE_AI_API_LOGS', { response: err.message, isError: true, payload, url, apiType: 'TABLE_COMPLETION_API', requestTime, responseTime: new Date() });
    if (process.env.SERVER_MAPPING !== "DISABLED") {
      if (err.message === "Server in maintenance") {
        url = null
        err.message = "All AI server down for table completion api"
      } else {
        const { ip, port } = getPortAndIp(url)
        discardGeneralServer({ ip, port, serverType: "TABLE_COMPLETION" })
      }
    }
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url,
        apiType: 'TABLE COMPLETION',
        payload,
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return reject(err);
  }
});

/**
 * processTableCompletion
 * @param {*} payload
 * @returns
 */
const processAutoTableCompletion = (payload) => new Promise(async (resolve, reject) => {
  let url = process.env.AUTO_TABLE_COMPLETION_API
  let requestTime = null
  try {
    console.log("auto table completion URL before", url)
    url = getLoadbalancerApi('AUTO_TABLE_COMPLETION', url)
    console.log("auto table completion URL", url)
    const formData = new FormData();

    // const response = await httpClient.get(url, { params: payload });
    for (const key in payload) {
      const value = typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : payload[key];
      formData.append(key, value);
    }
    const headers = { ...formData.getHeaders() };
    requestTime = new Date()
    const response = await httpClient.post(url, formData, { headers });
    console.log("auto table completion response", response.data)
    EMIT_EVENT('SAVE_AI_API_LOGS', { response: response.data, payload, url, apiType: 'AUTO_TABLE_COMPLETION_API', requestTime, responseTime: new Date() });
    return resolve(response.data);
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    EMIT_EVENT('SAVE_AI_API_LOGS', { response: err.message, isError: true, payload, url, apiType: 'AUTO_TABLE_COMPLETION_API', requestTime, responseTime: new Date() });
    if (process.env.SERVER_MAPPING !== "DISABLED") {
      if (err.message === "Server in maintenance") {
        url = null
        err.message = "All AI server down for auto table completion api"
      } else {
        const { ip, port } = getPortAndIp(url)
        discardGeneralServer({ ip, port, serverType: "AUTO_TABLE_COMPLETION" })
      }
    }
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url,
        apiType: 'AUTO TABLE COMPLETION',
        payload,
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return reject(err);
  }
});

/**
 * processTableCompletion
 * @param {*} payload
 * @returns
 */
const processFieldCompletion = (payload) => new Promise(async (resolve, reject) => {
  let url = process.env.FIELD_COMPLETION_API
  try {
    console.log("auto table completion URL before", url)
    url = getLoadbalancerApi('FIELD_COMPLETION', url)
    console.log("auto table completion URL", url)
    const formData = new FormData();

    // const response = await httpClient.get(url, { params: payload });
    for (const key in payload) {
      const value = typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : payload[key];
      formData.append(key, value);
    }
    const headers = { ...formData.getHeaders() };
    const response = await httpClient.post(url, formData, { headers });
    console.log("auto table completion response", response.data)
    return resolve(response.data);
  } catch (err) {
    // send emails to AI team in case of errors or API failed
    if (process.env.SERVER_MAPPING !== "DISABLED") {
      if (err.message === "Server in maintenance") {
        url = null
        err.message = "All AI server down for auto table completion api"
      } else {
        const { ip, port } = getPortAndIp(url)
        discardGeneralServer({ ip, port, serverType: "FIELD_COMPLETION" });
      }
    }
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url,
        apiType: 'AUTO TABLE COMPLETION',
        payload,
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return reject(err);
  }
});

const cpuUtilization = ({ url }) => new Promise(async (resolve) => {
  try {
    console.log("cpuUtilization URL", url)
    const { data } = await httpClient.get(url, { timeout: 500 });
    return resolve(data);
  } catch (err) {
    console.log(err)
    return resolve({ cpu: "NA" });
  }
});

const documentCompletion = (payload) => new Promise(async (resolve) => {
  let url = process.env.DOCUMENT_COMPLETION_API
  let dataToSend = {}
  try {
    // todo add batch completeion case in loadbalancer api in case not dedicated server
    // url = getLoadbalancerApi('DOCUMENT_COMPLETION', url)
    console.log("documentCompletion URL", url)
    if (!url) {
      return resolve(false);
    }
    url = getLoadbalancerApi('SNIPPET', url)
    console.log("request sent on DOCUMENT_COMPLETION_API", url)
    dataToSend = {
      address_id: payload.addressId || '',
      tenant_id: payload.tenantId,
      doc_id: payload.documentId,
      role: payload.role,
      email: payload.email,
      company_id: payload.externalCustomerId
    }
    const { data } = await httpClient.get(url, { timeout: 6000, data: dataToSend })
    console.log("response from DOCUMENT_COMPLETION_API", data)
    return resolve(data);
  } catch (err) {
    console.log(err)
    if (process.env.SERVER_MAPPING !== "DISABLED") {
      if (err.message === "Server in maintenance") {
        url = null
        err.message = "All AI server down for auto table completion api"
      } else {
        const { ip, port } = getPortAndIp(url)
        discardGeneralServer({ ip, port, serverType: "SNIPPET" })
      }
    }
    sendEmail({
      apiTarget: 'OCR',
      subject: 'AI_BUGS | IDP',
      body: JSON.stringify({
        environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
        url,
        apiType: 'DOCUMENT COMPLETION API',
        payload: dataToSend,
        error: err.message,
      }),
    }).then(() => { }).catch(() => { });
    return resolve(false);
  }
});
module.exports = {
  processOcr,
  processNonTabularTraining,
  processTabularTraining,
  processDocumentSnipplet,
  fetchOcrHealthStatus,
  fetchOcrFeedbackStatus,
  processQr,
  fetchQrHealthStatus,
  fetchBucketizationStatus,
  processBucketing,
  ocrValidateLogics,
  updateFlags,
  processVendorCorrection,
  processKeyValueExtract,
  generatePdf,
  rotateImages,
  processTableCompletion,
  processAutoTableCompletion,
  processFieldCompletion,
  cpuUtilization,
  documentCompletion
};
