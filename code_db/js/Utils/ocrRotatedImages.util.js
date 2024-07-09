// const config = require('config');
// const path = require('path');
const { auto, eachLimit } = require("async");
const {
    discardServer,
    checkIfWorkerisActive,
    occupyServer,
    releaseServer,
    mappingDown,
    getAllFreeServerKvpCount,
    occupyKvpNormalServer,
    getFreeServerKvp,
    getPortAndIp,
    totalActiveServers } = require("./load-balancer")
const { documentService, idpService } = require('../Services');
const AI_ENDPOINTS = require('./ai-endpoints.util');
const { EMIT_EVENT } = require('./data-emitter.util');
const { DEFAULT_CONTENT } = require("../Mock/non-tabular-content")
const { createNewMongooseId } = require('./universal-functions.util');
const { serverStatusAi, checkIfServerIsActive } = require('./serverMapping')
const PAGE = require('../Models/page.model');

let resurrectTriggered = false;

const processOcrForDocument = (doc, keyExtractUrl = null, callback) => {
    const pageArray = doc.pageArray
    auto({
        keyValueExtract: (cb) => {
            const pagesInv = pageArray.filter(e => e.page_type !== "#NEW_FORMAT#")
            const document = { ...doc, pageArray: pagesInv }
            const ocrClassification = doc.ocrClassification === 'PENDING' ? "IN_PROGRESS" : "WITHOUT_OCR_IN_PROGRESS";
            documentService.update({ _id: doc._id }, { $set: { ocrClassification, keyExtractRequestTime: new Date() } }, null, (e) => {
                console.log("document updated keyValueExtract", e)
                if (e) {
                    return cb(e)
                }
                AI_ENDPOINTS.processKeyValueExtract(document, keyExtractUrl).then((r) => {
                    console.log("respone sucess");
                    // keyValueExtract.wait
                    return cb(null, r)
                }).catch(e => {
                    console.log("respone ERROR", e);
                    return cb(null, { e, error: true })
                })
            })
        },
        checkPendingOcrReclassification: (cb) => {
            documentService.count({ ocrClassification: { $in: ['NOT_REQUIRED', 'PENDING'] } }, cb)
        },
        getDefaultContent: (cb) => {
            DEFAULT_CONTENT({ documentType: doc.docType, tenantId: doc.tenantId }, cb)
        },
        updateDocument: ['keyValueExtract', 'checkPendingOcrReclassification', 'getDefaultContent', ({ keyValueExtract, checkPendingOcrReclassification, getDefaultContent }, cb) => {
            // update document here
            console.log("here")
            let dataToSet = {};
            if (keyValueExtract && keyValueExtract.wait) { // reset to previous state
                if (!keyValueExtract.revert) {
                    return cb() // wait for webhook response
                }
                // undo kvp flags status
                process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED';
                process.env.KEY_VALUE_EXTRACT_OCR_LAST_ENABLED_AT = new Date()
                dataToSet = { ocrClassification: doc.ocrClassification, keyExtractRequestTime: null }
                documentService.update({ _id: doc._id }, { $set: dataToSet }, { new: true }, cb)
            } else {
                if (keyValueExtract.error) { // retry once
                    //     dataToSet = {
                    //         keyExtracted: false,
                    //         pdfMerged: false,
                    //         classification: "RETRY",
                    //         ocrClassification: "PENDING"
                    //     };
                    // } else {
                    dataToSet = {
                        ocrClassification: "FAILED", // classification failed
                        classification: "STARTED", // send for pdf spliteer
                        keyValueExtract: true // send for pdf spliteer
                    }
                    dataToSet.pageArray = []
                    doc.pageArray.forEach((p, i) => { // move farward with 16 keys empty values
                        if (i === 0) {
                            p.nonTabularContent = getDefaultContent.nonTabularContent.map(e => ({ ...e, fieldId: createNewMongooseId() }))
                            p.tabularContent = getDefaultContent.tabularContent
                        } else {
                            p.nonTabularContent = []
                        }
                        dataToSet.pageArray.push(p)
                    })
                }
                if (checkPendingOcrReclassification) {
                    process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED';
                    process.env.KEY_VALUE_EXTRACT_OCR_LAST_ENABLED_AT = new Date()
                } else {
                    process.env.KEY_VALUE_EXTRACT_OCR = 'DISABLED';
                }
                EMIT_EVENT("SUPER_ADMIN_REFRESH", { opType: "REFRESH", type: "SUPER_ADMIN_REFRESH" });
                console.log("dataToSet:", JSON.stringify(dataToSet))
                documentService.update({ _id: doc._id }, { $set: dataToSet }, { new: true }, cb)
            }
        }],
    }, (e, { keyValueExtract }) => {
        if (e || keyValueExtract.error) {
            console.log("KEY EXTRACT ERROR: ", doc._id, e, keyValueExtract.error)
            return callback(e || keyValueExtract.error)
        }
        callback(null, keyValueExtract)
    })
}
const processDocument = (file, freeServerIp, kvpOcr, callback) => {
    auto({
        checkIfWorkerActive: (cb) => {
            if (freeServerIp) {
                checkIfWorkerisActive(freeServerIp, (err, workerActiveFlag) => {
                    if (workerActiveFlag) {
                        cb(null, true)
                    } else {
                        discardServer(freeServerIp)
                        cb('WORKER_INACTIVE_ABORTING_THIS_REQUEST_AT_PLATFORM')
                    }
                })
            } else {
                cb('NO_FREE_SERVER')
            }
        },
        checkIfWorkerActiveOcr: (cb) => {
            if (!(process.env.GB_INFRA || process.env.NODE_ENV === "scalar")) {
                return cb()
            }
            console.log('checkIfWorkerActivekvpOcr>>', freeServerIp)
            //const freeServerIpOcr = serverStatusAi[`ip_${freeServerIp}`].ocrServer
            //console.log('checkIfWorkerActivekvpOcr>>', freeServerIpOcr)
            if (freeServerIp) {
                checkIfServerIsActive(freeServerIp, "OCR_SERVER", (err, workerActiveFlag) => {
                    if (workerActiveFlag) {
                        cb(null, true)
                    } else {
                        mappingDown(freeServerIp)
                        cb('WORKER_INACTIVE_ABORTING_THIS_REQUEST_AT_PLATFORM')
                    }
                })
            } else {
                cb('NO_FREE_SERVER')
            }
        },
        Pages: (cb) => {
            PAGE.find({ documentId: file._id }).sort({ pageNo: 1 }).lean().exec(cb)
        },
        sendDocumentoAI: ['checkIfWorkerActive', 'Pages', ({ checkIfWorkerActive, Pages }, cb) => {
            if (!checkIfWorkerActive) {
                return cb(null, null)
            }
            if (kvpOcr) {
                occupyServer(freeServerIp, false, "DOCUMENT_OCR");
            } else {
                occupyKvpNormalServer(freeServerIp, false);
            }
            const { port } = getPortAndIp(process.env.KEY_VALUE_EXTRACT_URL)
            if (Pages && Pages[0]) {
                file.pageArray = Pages
            }
            if (!(file.pageArray && file.pageArray[0])) {
                console.log(".................. Not found pageArray .............", file)
                return cb()
            }
            processOcrForDocument(file, `http://${freeServerIp}:${port}/processDocument`, (err, res) => {
                if (err) {
                    releaseServer(freeServerIp);
                    return cb()
                }
                if (res && res.hasOwnProperty('wait') && res.wait === true) {
                    // wait
                } else {
                    console.log("RELEASE SERVER", freeServerIp)
                    // releaseServer(freeServerIp) // release server from webhook
                }
                if (res.totalPages) {
                    idpService.update({ _id: file.idpId }, { $set: { totalPages: res.totalPages } }, null, cb)
                } else {
                    cb()
                }
            })
        }]
    },
        () => {
            // console.log('DONE PROCESSING FILE', err, res)
            callback()
        })
}
const executeInlimit = (documentBatches, limit, kvpOcr, callback) => {
    let resurrectTriggeredDone = false
    eachLimit(documentBatches, limit, (file, elcb) => {
        if (!file) {
            return elcb()
        }
        if (resurrectTriggered) {
            console.log("resurrection in progress in eachLimit")
            resurrectTriggeredDone = true;
            return elcb()
        }
        const { ip = null } = getPortAndIp(file.ocrUrl)
        const activeServers = totalActiveServers()
        let ocrOnDiffrentIp = null;
        if (activeServers > 1) {
            ocrOnDiffrentIp = (process.env.GB_INFRA || process.env.NODE_ENV === "scalar") && !process.env.SINGLE_IP
        }
        processDocument(file, getFreeServerKvp(false, ocrOnDiffrentIp && ip, kvpOcr), kvpOcr, elcb)
    }, () => {
        if (resurrectTriggeredDone) {
            console.log("resurrection in progress in return from eachLimit")
            resurrectTriggered = false
        }
        callback()
    })
}

const startRotatedFileOcrProcess = (callback) => {
    const serverStatus = getAllFreeServerKvpCount();
    const { freeServerCountKvpOcr: serverCount } = serverStatus;
    auto({
        documents: (cb) => {
            const criteria = { classification: 'STARTED', keyExtracted: false, ocrClassification: 'PENDING', status: "CLASSIFICATION_CHANGED" }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: serverCount }, cb)
        },
        retryDocuments: (cb) => {
            const criteria = { classification: 'RETRY', keyExtracted: false, ocrClassification: 'PENDING' }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: serverCount }, cb)
        },
        startProcessing: ['documents', ({ documents, retryDocuments }, cb) => {
            const QUEUE = documents.concat(retryDocuments)
            if (!(QUEUE && QUEUE[0])) {
                process.env.KEY_VALUE_EXTRACT_OCR = 'DISABLED'
                return cb(null, true);
            }
            process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED'
            process.env.KEY_VALUE_EXTRACT_OCR_LAST_ENABLED_AT = new Date()

            if (!serverCount) {
                // console.log("Stoped now free server count startRotatedFileOcrProcess: ", serverCount)
                return callback(null, true)
            }
            EMIT_EVENT("SUPER_ADMIN_REFRESH", { opType: "REFRESH", type: "SUPER_ADMIN_REFRESH" });
            console.log("document sent for rotation ocr", serverCount)
            executeInlimit(QUEUE, serverCount, true, cb)
        }]
    }, (err, res) => {
        callback(err, [res])
    })
}

const startKvpFileProcess = (callback) => {
    const serverStatus = getAllFreeServerKvpCount();
    const { freeServerCountKvpNormal: serverCount } = serverStatus;
    // console.log("Start KVP", serverStatus)
    if (!serverCount) {
        // console.log("Stoped now free server count startKvpFileProcess: ", serverCount)
        return callback(null, true)
    }
    auto({
        documents: (cb) => {
            const criteria = { classification: 'STARTED', keyExtracted: false, ocrClassification: 'NOT_REQUIRED', status: "CLASSIFICATION_CHANGED" }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: serverCount }, cb)
        },
        retryDocuments: (cb) => {
            const criteria = { classification: 'RETRY', keyExtracted: false, ocrClassification: 'NOT_REQUIRED' }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: serverCount }, cb)
        },
        startProcessing: ['documents', 'retryDocuments', ({ documents, retryDocuments }, cb) => {
            const QUEUE = documents.concat(retryDocuments)
            if (!(QUEUE && QUEUE[0])) {
                return cb(null, true);
            }
            executeInlimit(QUEUE, serverCount, false, cb)
        }]
    }, (err, res) => {
        callback(err, [res])
    })
}

process.on('addResurrectedServers', (payload) => {
    if (payload.serversResurrected > 1 && !payload.firstRun) {
        resurrectTriggered = true;
    }
    console.log('simultaneousProcess now set to after serversResurrected ocrRotattedimages ', payload)
})
module.exports = {
    startRotatedFileOcrProcess,
    startKvpFileProcess
}
