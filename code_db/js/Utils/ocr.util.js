const config = require('config');
const path = require('path');
const { auto, eachLimit } = require("async");
const { discardServer, checkIfWorkerisActive, occupyServer, releaseServer, getServerStatus, getFreeServer, getPortAndIp, mappingDown, totalActiveServers } = require("./load-balancer")
const { serverStatusAi, checkIfServerIsActive } = require('./serverMapping')
const { documentService, idpService } = require('../Services');
const { toTimeZone, createMongooseId } = require("./universal-functions.util")
const AI_ENDPOINTS = require('./ai-endpoints.util');
const { EMIT_EVENT } = require('./data-emitter.util');
const { _customizeOcrResponse } = require('../Helpers/ocr');
const mappingController = require('../Controllers/mapping.controller');
const ImcAPIEndPoints = require('./imc-endpoints.util');
const { mockVoice } = require('../Mock/ocr.mock');
const BACK_UP = require('../Models/idp-documentlist-backup.model')

const APP_EVENTS = config.get('APP_EVENTS');
const SOCKET_EVENTS = config.get('SOCKET_EVENTS');
const AI_STATUS = config.get('AI_STATUS');
const appPathDir = path.join(__dirname, '../../', 'uploads/');
const CRON_DOCS_TO_PROCESS_PER_BATCH = config.get('SERVER.CRON_DOCS_TO_PROCESS_PER_BATCH');
const OCR = config.get('OCR');
const OCR_APIS = OCR.APIS.DOCUMENT_OCR
const OCR_TIME = config.get('OCR_MAX_TIME_LIMIT');
const OCR_RETRY_TIME = config.get('OCR_RETRY_MAX_TIME_LIMIT');

// const STAND_ALONE = config.get('STAND_ALONE')
const STAND_ALONE = process.env.STAND_ALONE || false;

const SELECTED_BATCHES_STACK = {};
let OCR_DOCUMENT_QUEUE = []
let PORT = process.env.AI_PORT || 7035
if (process.env.GB_INFRA || process.env.NODE_ENV === "scalar") {
    // default 7035
} else {
    const { port } = getPortAndIp(OCR_APIS)
    PORT = port
    console.log("OCR PORT CHJANGED TO : ", port)
}
let initialWaitOver = true;
let simultaneousProcess = 0;
let resurrectTriggered = false;

const durationCounter = {
    initialWaitOver: initialWaitOver ? 'YES' : 'NO',
    currentlyProcessing: "NONE",
    appRestartedAt: toTimeZone(new Date().toISOString()),
    minTime: 0,
    maxTime: 0,
    avgAITime: 0,
    avgOverallTime: 0,
    lastHourlyThroughput: 0,
    currentHourlyThroughput: 0,
    lastHourIncoming: 0,
    totalTime: 0,
    freshCounterVal: 0,
    totalFiles: 0,
    duplicate: 0,
    skippedFilesForImageNotFound: 0,
    deferredFiles: 0,
    failedFiles: 0,
    freeServerNotFound: 0,
    serverBusy: 0,
    duration: 0,
    instanceInitialized: 0,
    activeInstances: 0,
    activeProcess: 0
}
const saveBackupForBatch = (idpId, callback) => {
    //console.log("BACKUP>>> BACKUP SAVing.....")
    auto({
        checkBackUp: (cb) => {
            BACK_UP.findOne({ idpId }, (e, r) => {
                if (e) {
                    return cb(e)
                }
                if (r) {
                    return cb("backup already exists")
                }
                cb()
            })
        },
        batch: ['checkBackUp', (_, cb) => {
            idpService.findOne({ _id: idpId }, null, null, null, cb)
        }],
        documents: ['checkBackUp', (_, cb) => {
            documentService.findAll({ idpId }, null, null, cb)
        }],
        createIdpBackUp: ['batch', 'documents', ({ documents, batch }, cb) => {
            console.log("BACKUP>>> ready to create backup", idpId)
            new BACK_UP({ idpId, documents, batch }).save(cb)
        }]
    }, (err) => {
        if (err) {
            console.error(err)
        }
        console.log("BACKUP>>> BACKUP SAVED", idpId)
        callback()
    })
}
/**
 * Verify document count for batch
 */
const verifyDocumentCount = (idpId, backup = false, callback) => {
    let batchCompleted = false;
    let sendAlert = false
    //console.log("BACKUP>>> verifyDocumentCountverifyDocumentCount", idpId, backup)
    auto({
        filesCount: (cb) => {
            documentService.count({ idpId }, cb)
        },
        filesUploadedCount: (cb) => { // failed files Count
            documentService.aggregation([
                { $match: { idpId: createMongooseId(idpId) } },
                {
                    $group: {
                        _id: "$fileName"
                    }
                },
                {
                    $group: {
                        _id: null,
                        filesCount: { $sum: 1 },
                    }
                }
            ], (err, res) => {
                if (err || !(res && res[0])) {
                    return cb(null, 0)
                }
                const result = res && res[0];
                cb(null, result.filesCount || 0)
            })
        },
        ocrFailedCount: (cb) => { // failed files Count
            documentService.aggregation([
                { $match: { idpId: createMongooseId(idpId), aiStatus: AI_STATUS.OCR_FAILED } },
                {
                    $group: {
                        _id: "$fileName"
                    }
                },
                {
                    $group: {
                        _id: null,
                        failedFilesCount: { $sum: 1 },
                    }
                }
            ], (err, res) => {
                if (err || !(res && res[0])) {
                    return cb(null, 0)
                }
                const result = res && res[0];
                cb(null, result.failedFilesCount || 0)
            })
            // documentService.count({ idpId, aiStatus: AI_STATUS.OCR_FAILED }, cb)
        },
        identifiedCount: (cb) => {
            documentService.count({ idpId, aiStatus: AI_STATUS.OCR_DONE, isTableFlag: true, isNonTableFlag: true }, cb)
        },
        nonIdentifiedCount: (cb) => {
            documentService.count({ idpId, aiStatus: AI_STATUS.OCR_DONE, $or: [{ isTableFlag: false }, { isNonTableFlag: false }] }, cb)
        },
        ocrPending: (cb) => {
            documentService.count({ idpId, aiStatus: AI_STATUS.OCR_PENDING }, cb)
        },
        ocrPassedCount: ['identifiedCount', 'nonIdentifiedCount', ({ identifiedCount = 0, nonIdentifiedCount = 0 }, cb) => {
            cb(null, nonIdentifiedCount + identifiedCount)
        }],
        updateBatch: ['ocrFailedCount', 'ocrPassedCount', 'ocrPending', 'filesCount', 'filesUploadedCount', (countData, cb) => {
            const { filesCount, ocrFailedCount, identifiedCount, nonIdentifiedCount, ocrPassedCount, ocrPending = 0, filesUploadedCount } = countData
            let dataToSet = { filesCount, ocrFailedCount, identifiedCount, nonIdentifiedCount, ocrPassedCount }
            if (filesCount !== (ocrPassedCount + ocrFailedCount + ocrPending)) {
                // console.log("ocrPassedCount", "ocrFailedCount", "ocrPending", ocrPassedCount, ocrFailedCount, ocrPending)
                sendAlert = false
            }
            if (filesUploadedCount === ocrFailedCount || (filesCount === (ocrPassedCount + ocrFailedCount) && ocrPending === 0)) {
                dataToSet = { ...dataToSet, step: 1, ocrStatus: 'COMPLETED' }
                batchCompleted = true;
            }
            if (ocrPending > 0) {
                dataToSet = { ...dataToSet, step: 0, ocrStatus: 'PENDING' }
            }
            idpService.update({ _id: idpId }, { $set: dataToSet }, cb)
        }],
        createBackup: ['updateBatch', (_, cb) => {
            //console.log("BACKUP>>> createBackup create Backup", batchCompleted, backup)
            if (!batchCompleted || !backup) {
                return cb()
            }
            saveBackupForBatch(idpId, cb)
        }]
    }, () => {
        if (sendAlert) {
            ImcAPIEndPoints.sendEmail({
                apiTarget: 'PLATFORM',
                subject: `DOC_COUNT_MISMATCH_BUGS | IDP | ${process.env.NODE_ENV}`,
                body: JSON.stringify({
                    environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
                    idpId,
                    backup
                }),
            }).then(() => { }).catch(() => { });
        }
        callback()
    })
}

const changeStatus = (batchId, hcb) => {
    auto({
        BATCH: (cb) => {
            idpService.findOne({ _id: batchId }, cb)
        },
        UPDATE_BATCH: ['BATCH', ({ BATCH }, cb) => {
            if (!BATCH) {
                return cb(null, null)
            }
            // console.log("BACKUP>>> changeStatus, changeStatus = changeStatus,", batchId)
            verifyDocumentCount(batchId, true, cb)
        }],
    }, (err) => {
        if (err) {
            console.log("ERROR 373", err)
            return hcb(err)
        }
        // console.log("BATCH updated")
        return hcb(null, true)
    })
}

const processOcrForFile = async (file, ocrUrl = null) => {
    const {
        tenantId, pageNo = 1, idpId: batchId, opType = null, _id: documentId,
        fileOriginalName: docName = null, filePath = null, externalCustomerId = null,
        splitFilePageRange
    } = file;
    const configId = file.configId || null;
    let ocrResponse
    const fileUrl = file.s3Url || `${appPathDir}${filePath}`
    try {
        if (process.env.NODE_ENV === 'test') {
            ocrResponse = await mockVoice(tenantId, documentId)
        } else {
            console.log("Sending file ", file.aiStatus)
            ocrResponse = await AI_ENDPOINTS.processOcr({
                path: fileUrl,
                tenantId,
                documentId,
                docName,
                ocrServer: ocrUrl,
                externalCustomerId,
                external: file.external,
                splitFilePageRange,
                uploadedDocType: file.uploadedDocType
            });
        }
        if (ocrResponse && ocrResponse.wait) {
            return Promise.resolve(ocrResponse);
        }
        if (ocrResponse.hasOwnProperty('error') && ocrResponse.error === '[AI]--OUTPUT_FAILURE'
            && ocrResponse.hasOwnProperty("errorCode") && ocrResponse.errorCode === 1) {
            ocrResponse = {
                ...ocrResponse,
                corruptFile: true
            }
        }
        ocrResponse = _customizeOcrResponse(ocrResponse);
        ocrResponse = {
            ...ocrResponse,
            // create mapping from the response
            mapping: await mappingController.mappingOcrFields(
                configId,
                { ...ocrResponse },
                file,
            ),
        };

        const aggregateData = {
            emitSocket: true,
            type: AI_STATUS.OCR_DONE,
            socketType: opType === 'PROCESSING' ? SOCKET_EVENTS.OCR_DOCUMENT : SOCKET_EVENTS.OCR_TRAINING_DOCUMENT,
            ocrResponse: {
                opType,
                tenantId,
                batchId,
                documentId,
                pageNo,
                ...ocrResponse,
            },
        };
        EMIT_EVENT(APP_EVENTS.OCR, aggregateData);
        return Promise.resolve(true);
    } catch (err) {
        ImcAPIEndPoints.sendEmail({
            apiTarget: 'PLATFORM',
            subject: `AI_BUGS | IDP | ${process.env.NODE_ENV}`,
            body: JSON.stringify({
                environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
                apiType: 'DOCUMENT_OCR',
                tenantId,
                documentId,
                response: ocrResponse,
                err: err.message,
            }),
            filePath: `${appPathDir}${filePath}`,
        }).then(() => { }).catch(() => { });
        const mapping = await mappingController.mappingOcrFields(
            configId,
            { aiStatus: AI_STATUS.OCR_FAILED, type: null },
            file,
        );
        EMIT_EVENT(APP_EVENTS.OCR, {
            emitSocket: true,
            socketType: 'PUBLISH_AI_STATUS_DOCUMENTS',
            ocrResponse: {
                opType,
                tenantId,
                batchId,
                documentId,
                pageNo,
                aiStatus: AI_STATUS.OCR_FAILED,
                docType: null,
                mapping,
            },
        });
        EMIT_EVENT(APP_EVENTS.AI_ERROR, {
            type: AI_STATUS.OCR_FAILED,
            err: err.message || AI_STATUS.OCR_FAILED,
            docId: documentId,
        });
        return Promise.resolve(false);
    }
}
const processBatch = (file, freeServerIp, callback) => {
    auto({
        checkIfWorkerActive: (cb) => {
            console.log('checkIfWorkerActivefreeServerIp', freeServerIp)
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
            console.log('checkIfWorkerActiveOcr>>', freeServerIp)
            //const freeServerIpOcr = serverStatusAi[`ip_${freeServerIp}`].ocrServer
            //console.log('checkIfWorkerActiveOcr>>', freeServerIpOcr)
            if (freeServerIp) {
                checkIfServerIsActive(freeServerIp, "OCR_SERVER", (err, workerActiveFlag) => {
                    if (workerActiveFlag) {
                        cb(null, true)
                    } else {
                        console.log('OCR_PORT_DOWN_FOR', freeServerIp)
                        mappingDown(freeServerIp)
                        cb('WORKER_INACTIVE_ABORTING_THIS_REQUEST_AT_PLATFORM')
                    }
                })
            } else {
                cb('NO_FREE_SERVER')
            }
        },
        sendFileToAI: ['checkIfWorkerActive', 'checkIfWorkerActiveOcr', ({ checkIfWorkerActive }, cb) => {
            if (!checkIfWorkerActive) {
                return cb(null, null)
            }
            occupyServer(freeServerIp);
            processOcrForFile(file, `http://${freeServerIp}:${PORT}/processDocument`).then((res) => {
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
            }).catch(() => {
                releaseServer(freeServerIp); // TODO needs to verify
                cb()
            })
        }]
    },
        (err) => {
            console.log('DONE PROCESSING FILE', err)
            callback()
        })
}
const executeInlimit = (documentBatches, limit, callback) => {
    let resurrectTriggeredDone = false
    eachLimit(documentBatches, limit, (file, elcb) => {
        // const freeIp = servers[index % limit] // TODO need to verify getfreeserverip
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
        processBatch(file, getFreeServer(false, ocrOnDiffrentIp && ip, file.splitFileOcr), elcb)
    }, () => {
        if (resurrectTriggeredDone) {
            console.log("resurrection in progress in return from eachLimit")
            resurrectTriggered = false
        }
        callback()
    })
}
let splitFileOcr = false
const startOcrProcess = (callback) => {
    splitFileOcr = !splitFileOcr
    const serverStatus = getServerStatus(splitFileOcr)
    const { serverSummary: { FREE: serverCount = 0 } } = serverStatus;
    if (!serverCount) {
        // console.log("Stoped now free server count: ", serverCount)
        return callback(null, true)
    }
    auto({
        Batches: (cb) => {
            const criteria = { workflowId: { $ne: null }, isDeleted: false, step: { $in: [0] } }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            idpService.findAll(criteria,
                { _id: 1 },
                { limit: CRON_DOCS_TO_PROCESS_PER_BATCH, lean: true }, (err, batches) => {
                    if (err || (batches && !batches.length)) {
                        return cb()
                    }
                    return cb(null, batches)
                });
        },
        Documents: ["Batches", ({ Batches }, cb) => {
            if (!Batches) {
                return cb()
            }
            const batchIds = Batches.map(e => e._id);
            const matchQuery = {
                configId: { $ne: null },
                isDeleted: false,
                aiStatus: AI_STATUS.OCR_PENDING,
                splitFileOcr
            }
            let options = { lean: true, limit: CRON_DOCS_TO_PROCESS_PER_BATCH }
            if (!STAND_ALONE) {
                matchQuery.idpId = { $in: batchIds }
                options = { lean: true }
            }
            options.sort = { createdAt: 1 }
            if (process.env.SINGLE_TENANT_ID) {
                matchQuery.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(matchQuery, {}, options, cb)
        }],
        prepareDocsForOcr: ['Documents', ({ Documents }, cb) => {
            if (!Documents) {
                OCR_DOCUMENT_QUEUE = [null]
                return cb()
            }
            if (STAND_ALONE) {
                OCR_DOCUMENT_QUEUE = Documents
                return cb()
            }
            Documents.forEach(document => {
                if (SELECTED_BATCHES_STACK[document.idpId]) {
                    SELECTED_BATCHES_STACK[document.idpId].push(document);
                } else {
                    SELECTED_BATCHES_STACK[document.idpId] = [document];
                }
            })

            let keyLength = Object.keys(SELECTED_BATCHES_STACK).length
            while (keyLength) {
                keyLength = Object.keys(SELECTED_BATCHES_STACK).length
                if (keyLength === 1) {
                    const k = Object.keys(SELECTED_BATCHES_STACK)[0]
                    OCR_DOCUMENT_QUEUE.push(...SELECTED_BATCHES_STACK[k])
                    delete SELECTED_BATCHES_STACK[k];
                } else {
                    Object.keys(SELECTED_BATCHES_STACK).forEach((k) => {
                        if (!SELECTED_BATCHES_STACK[k][0]) {
                            delete SELECTED_BATCHES_STACK[k]
                        } else {
                            OCR_DOCUMENT_QUEUE.push(SELECTED_BATCHES_STACK[k].shift())
                        }
                    })
                }
            }
            cb()
        }],
        docsInprogress: ['prepareDocsForOcr', (_, cb) => {
            const beforeTime = new Date().getTime() - 1000 * 60 * 10; // before 10 minute
            const matchQuery = { aiStatus: AI_STATUS.OCR_INPROGRESS, ocrRequestTime: { $lt: new Date(beforeTime) } }
            const options = { lean: true }
            // console.log("prepareDocsForOcr<Q", matchQuery)
            if (process.env.SINGLE_TENANT_ID) {
                matchQuery.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(matchQuery, {}, options, (e, documents) => {
                if (e) {
                    return cb(e);
                }
                // console.log("DOUCKN<J", documents)
                documents.forEach(file => {
                    const requestTime = new Date(file.ocrRequestTime).getTime();
                    const currentTime = new Date().getTime();
                    const timeDiff = currentTime - requestTime;
                    const expectedOcrTime = (1000 * 60 * OCR_TIME * (+file.totalPages)) + (1000 * 60 * (OCR_RETRY_TIME + 2))
                    // console.log("timeDiff,expectedOcrTime", timeDiff, expectedOcrTime)
                    // console.log("expectedOcrTime", OCR_TIME, (+file.totalPages))
                    if (timeDiff > expectedOcrTime) {
                        if (!(OCR_DOCUMENT_QUEUE && OCR_DOCUMENT_QUEUE[0])) {
                            OCR_DOCUMENT_QUEUE = [file];
                        } else {
                            OCR_DOCUMENT_QUEUE.unshift(file);
                        }
                    }
                })
                cb()
            })
        }],
        startProcessing: ['docsInprogress', (_, cb) => {
            const { serverSummary: { FREE: serverCount = 0 } } = getServerStatus(splitFileOcr);
            if (!serverCount || !(OCR_DOCUMENT_QUEUE && OCR_DOCUMENT_QUEUE[0])) {
                return cb(null, true);
            }
            console.log("OCR_DOCUMENT_QUEUE sent for process ", serverCount, OCR_DOCUMENT_QUEUE.length)
            executeInlimit(OCR_DOCUMENT_QUEUE, serverCount, cb)
        }],
        updateBatches: ['startProcessing', ({ Batches }, cb) => {
            eachLimit(Batches || [], 50, (batch, elcb) => {
                changeStatus(batch._id, elcb)
            }, cb)
        }]
    }, (err, res) => {
        OCR_DOCUMENT_QUEUE = []
        callback(err, [res])
    })
}

process.on('updateFinalActiveServers', (finalActiveServers) => {
    if (finalActiveServers) {
        simultaneousProcess = finalActiveServers
        durationCounter.instanceInitialized = finalActiveServers
        durationCounter.activeInstances = finalActiveServers
    }
    //console.log('simultaneousProcess now set to ', simultaneousProcess)
    if (simultaneousProcess && !initialWaitOver) {
        console.log('Will Start process in 5 mins from now...')

        setTimeout(() => {
            initialWaitOver = true;
            process.emit('startJob')
        }, 5 * 60 * 1000) // after 5 mins
    }
    console.log(finalActiveServers)
})

process.on('addResurrectedServers', (payload) => {
    simultaneousProcess += payload.serversResurrected;
    durationCounter.activeInstances += payload.serversResurrected
    if (payload.serversResurrected > 1 && !payload.firstRun) {
        resurrectTriggered = true;
    }
    if (!initialWaitOver && payload.serversResurrected) {
        setTimeout(() => {
            initialWaitOver = true;
            process.emit('startJob')
        }, 0.5 * 60 * 1000) // after 5 mins
    }
    //console.log('simultaneousProcess now set to after serversResurrected ', payload)
    // }
})

process.on('startJob', () => {
    console.log('Starting job...')
    // startOcrProcess()
})
process.on('startAIProcessing', () => {
    initialWaitOver = true;
})
module.exports = {
    startOcrProcess,
    verifyDocumentCount
}
