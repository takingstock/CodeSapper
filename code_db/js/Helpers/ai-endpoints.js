const config = require('config');
const { auto } = require("async");
const { documentService } = require('../Services');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const mappingController = require('../Controllers/mapping.controller');
const { sendEmail } = require('../Utils/imc-endpoints.util');
const { getFreeSnippetServers, getFieldCompletionServers, getFreeAutoTableCompletionServers, getFreeTableCompletionServers, getFreeKeyValueExtractionServers, getFreePdfGeneratorServers, getPortAndIp, getFreeImageRotatorServers, checkIfWorkerisActive, discardServer } = require('../Utils/load-balancer')
const { BoomCustomError } = require('../Utils/universal-functions.util');

const OCR_TIME = config.get('OCR_MAX_TIME_LIMIT');
const OCR_RETRY_TIME = config.get('OCR_RETRY_MAX_TIME_LIMIT');
const APP_EVENTS = config.get('APP_EVENTS');
const AI_STATUS = config.get('AI_STATUS');
const ERROR_MSG = config.get('STATUS_MSG.ERROR');
/**
 * retry file/doument for ocr 5 minutes
 * @param {*} file
 */
const retryOcr = (file) => {
    const { _id } = file
    setTimeout(() => {
        auto({
            file: (cb) => {
                documentService.findOne({ _id }, null, null, null, cb);
            },
            retry: ['file', ({ file }, cb) => {
                if (file.ocrRetry === 1 && file.aiStatus === AI_STATUS.OCR_RETRY) {
                    documentService.update({ _id }, { $set: { ocrRetry: 1, aiStatus: AI_STATUS.OCR_PENDING } }, { new: true }, cb);
                } else {
                    cb();
                }
            }]
        }, (err, { retry }) => {
            console.log("err, OCR RETRY for :", err, retry)
        })
    }, 1000 * 60 * OCR_RETRY_TIME)
}

const waitForResponse = (payload, ocrData, path, ocrUrl) => {
    const pages = ocrData.totalPages || 1
    setTimeout(() => {
        auto({
            file: (cb) => {
                documentService.findOne({ _id: payload.doc_id }, null, null, null, (e, doc) => {
                    if (!doc) {
                        return cb("document not found")
                    }
                    cb(e, doc)
                });
            },
            updateDoucment: ['file', ({ file }, cb) => {
                if (!file.ocrRetry && file.aiStatus === AI_STATUS.OCR_INPROGRESS) {
                    retryOcr({ _id: payload.doc_id })
                    documentService.update({ _id: payload.doc_id }, { $set: { ocrRetry: 1, aiStatus: AI_STATUS.OCR_RETRY } }, { new: true }, cb);
                }
            }],
            ocrfailedfile: ['file', ({ file }, cb) => {
                if (file.ocrRetry && file.aiStatus === AI_STATUS.OCR_INPROGRESS) {
                    mappingController.mappingOcrFields(
                        null,
                        { aiStatus: AI_STATUS.OCR_FAILED, type: null },
                        file,
                    ).then(mapping => {
                        EMIT_EVENT(APP_EVENTS.OCR, {
                            emitSocket: true,
                            socketType: 'PUBLISH_AI_STATUS_DOCUMENTS',
                            ocrResponse: {
                                opType: file.opType,
                                tenantId: file.tenantId,
                                batchId: file.idpId,
                                documentId: file._id,
                                pageNo: 1,
                                aiStatus: AI_STATUS.OCR_FAILED,
                                docType: null,
                                mapping,
                            },
                        });
                    })
                }
                cb()
            }],
            sendMail: ['file', ({ file }, cb) => {
                if (file.aiStatus === AI_STATUS.OCR_INPROGRESS) {
                    sendEmail({
                        apiTarget: 'OCR',
                        subject: 'AI_BUGS | IDP | OCR',
                        body: JSON.stringify({
                            environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
                            url: ocrUrl,
                            apiType: 'DOCUMENT_OCR',
                            ocrRetryCount: !file.ocrRetry ? file.ocrRetry + 1 : file.ocrRetry,
                            error: `Timeout for ${pages} pages, with ${pages * OCR_TIME} minutes exceeds`,
                            fileOrignalPath: path,
                            filePath: file.s3Url,
                            fileOriginalName: file.fileOriginalName,
                            documentId: file._id,
                            idpId: file.idpid
                        }),
                    }).then(() => { }).catch(() => { })
                    setTimeout(() => {
                        process.emit("lockIp", { ocrUrl, ipOcrLock: false, from: "waitForResponse ai enpoints controller time out" })
                    }, 1000 * 60 * 1)
                }
                cb()
            }]
        }, (e) => {
            if (e) {
                console.log("waitForResponse:", e)
                console.log("waitForResponse payload:", payload)
            }
        })
    }, 1000 * 60 * OCR_TIME * pages) // temporary make it 2 minutes per page
}

const checkServer = (type, url) => new Promise((resolve) => {
    console.log('CHECKING SERVER INACTIVE', type, url)
    if (url) {
        checkIfWorkerisActive(url, (err, workerActiveFlag) => {
            if (workerActiveFlag) {
                resolve({ serverUp: true, wait: false })
            } else {
                console.log('WORKER_INACTIVE_ABORTING_THIS_REQUEST_AT_PLATFORM', type)
                discardServer(url)
                resolve({ serverUp: false, wait: true })
            }
        })
    } else {
        resolve({ serverUp: false, wait: true });
    }
})

const getLoadbalancerApi = (type, defaultUrl) => {
    if (process.env.SERVER_MAPPING === "DISABLED") {
        return defaultUrl
    }
    let url;
    let servers = []
    switch (type) {
        case 'KEY_VALUE':
            servers = getFreeKeyValueExtractionServers()
            break;
        case 'SNIPPET':
            servers = getFreeSnippetServers();
            break;
        case 'PDF_GENERATOR':
            servers = getFreePdfGeneratorServers();
            break;
        case 'IMAGE_ROTATOR':
            servers = getFreeImageRotatorServers();
            break
        case 'TABLE_COMPLETION':
            servers = getFreeTableCompletionServers();
            break;
        case 'AUTO_TABLE_COMPLETION':
            servers = getFreeAutoTableCompletionServers();
            break;
        case 'FIELD_COMPLETION':
            servers = getFieldCompletionServers();
            break;
        default:
            servers = []
    }
    if (servers && servers[0]) {
        const server = servers[0];
        // eslint-disable-next-line operator-assignment
        server[type].totalRequestSent = server[type].totalRequestSent + 1
        const { ip } = getPortAndIp(defaultUrl)
        if (server.ip && defaultUrl) {
            url = defaultUrl.replace(ip, server.ip);
        }
    }
    if (!url) {
        throw BoomCustomError(ERROR_MSG.MAINTENANCE);
    }
    return url
}
const checkImmediateOcrRetry = ({ documentId }) => new Promise((resolve) => {
    let retried = false
    auto({
        checkDocument: (cb) => {
            documentService.findOne({ _id: documentId }, { ocrRetry: 1 }, {}, null, cb);
        },
        updateDocument: ['checkDocument', ({ checkDocument: file }, cb) => {
            // let retry = null
            if (file && file.ocrRetry !== 2) {
                // retry = (file.ocrRetry + 1) || 1
                retried = true
            } else {
                return cb(null, false)
            }
            documentService.updateAll({ _id: documentId }, { $set: { aiStatus: AI_STATUS.OCR_PENDING, ocrRetry: 2 } }, null, cb)
        }]
    }, () => {
        return resolve(retried)
    })
})
module.exports = {
    checkServer,
    waitForResponse,
    getLoadbalancerApi,
    checkImmediateOcrRetry
};
