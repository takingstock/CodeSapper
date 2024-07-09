const config = require('config')
const { auto, eachOfSeries, eachSeries } = require('async');
const { documentService, idpService } = require('../Services');
// const SPLIT_FILE = require('../Models/splitFile.model')
const { executeRemoteSSHQuery, createMongooseId } = require("../Utils/universal-functions.util");
const { serverStatus: serverStatusAi } = require("../Utils/load-balancer")
const { autoScaleAiServers } = require("../Utils/admin-dashboard.util")
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const { sendEmail } = require('../Utils/imc-endpoints.util');
const BACK_UP = require('../Models/idp-documentlist-backup.model')

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const AI_STATUS = config.get('AI_STATUS');

const rebootServer = (data = {}) => {
    const { ip } = data
    console.log("reboot server data:", data)
    let keyName = ip
    let selectedServer = null
    if (ip.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    selectedServer = serverStatusAi[keyName]
    selectedServer.currentStatus = 'REBOOTING';
    selectedServer.lastReboot = new Date().toISOString()
    selectedServer.totalReboots++
    console.log("EXecuting rebooot for server", selectedServer)
    executeRemoteSSHQuery('sudo reboot', selectedServer.ip)
}
const _newSplitFileDocument = (data, hcb) => {
    delete data._id
    delete data.createdAt
    delete data.updatedAt
    auto({
        doc: (cb) => {
            documentService.create(data, cb)
        },
    }, (err, { doc }) => {
        if (err) {
            console.log("ERR on 13", err)
            console.log("ERR on 14", data)
        }
        hcb(null, doc)
    })
}
const generateSplitDocs = (totalPages, doc, callback) => {
    const rangeLimit = +process.env.FILE_PAGES_ON_SERVER_LIMIT
    const ranges = []
    for (let i = 0; i < totalPages; i += rangeLimit) {
        const range = `${i + 1}____${i + rangeLimit}`
        ranges.push(range)
    }

    const lastRange = `${ranges.slice(-1)[0].split('____')[0]}____${totalPages}`
    ranges.splice(-1)
    ranges.push(lastRange)
    console.log("rangesrangesrangesrangesranges", ranges)
    autoScaleAiServers({ numberOfServers: ranges.length, scalarType: "S_AWS_AUTO_SCALAR_GROUP_NAME" }, () => {
        console.log("upscale done for S_AWS_AUTO_SCALAR_GROUP_NAME", process.env['S_AWS_AUTO_SCALAR_GROUP_NAME'])
    })
    eachOfSeries(ranges, (pageRange, key, ecb) => {
        const dataToSet = {
            splitFilePageRange: pageRange,
            ocrRequestTime: null,
            ocrUrl: null,
            aiStatus: AI_STATUS.OCR_PENDING,
            reason: "LARGE FILE PROCESSIING APPROVED",
            ocrRetry: 0
        }
        if (key === 0) {
            documentService.update({ _id: doc._id }, { $set: dataToSet }, null, ecb)
        } else {
            const dataToAdd = {
                ...doc,
                ...dataToSet
            }
            _newSplitFileDocument(dataToAdd, ecb)
        }
    }, callback)
}

/**
 * STEP 1 detected large file
 * @param {*} data
 * @param {*} callback
 */
const createSplitFile = (data, callback) => {
    if (!data.totalPages) {
        callback()
    }
    auto({
        rebootingServer: (cb) => {
            rebootServer({ ip: data.ip })
            cb()
        },
        document: (cb) => {
            documentService.findOne({ _id: data.documentId }, {}, null, null, cb)
        },
        generateSplitFiles: ['document', ({ document }, cb) => {
            const dataToSet = {
                ocrRequestTime: null,
                ocrUrl: null,
                aiStatus: AI_STATUS.OCR_FAILED,
                reason: "LARGE FILE",
                ocrRetry: 0
            }
            documentService.update({ _id: document._id }, { $set: dataToSet }, null, cb)
            const newPayload = {
                aiStatus: dataToSet.aiStatus,
                idpId: document.idpId,
                documentId: document._id,
                data: dataToSet,
                fileOriginalName: document.fileOriginalName
            }
            EMIT_EVENT('SAVE_LOG', { data: newPayload, from: 'LARGE_FILE_DETECTED' });
            // generateSplitDocs(ranges, document, cb)
        }]
    }, (e, { document }) => {
        let apiTarget = "OCR"
        if (process.env.NODE_ENV_LABEL === "MARK_PROD" && document.tenantId && document.tenantId.toString() === "641a8d7c9285c7df7da42a6d") {
            apiTarget = "QUEUE_SIZE_ALERT2"
        }
        sendEmail({
            apiTarget,
            subject: 'IDP | OCR | LARGE_FILE_DETECTED',
            body: `Large file (${document.fileOriginalName}) detected on ${data.ip} total pages ${data.totalPages}`
        }).then(() => { }).catch(() => { })
        callback()
    })
}

/**
 * STEP 3 detected large file
 * @param {*} data
 * @param {*} callback
 */
const generateDocNumbers = (data, callback) => {
    auto({
        checkSplitFile: (cb) => {
            documentService.findOne({ _id: data.documentId, splitFileOcr: true }, {}, null, null, (e, r) => {
                if (!r) {
                    return cb("invalid documnet file");
                }
                return cb(null, r)
            })
        },
        checkDoc: ['checkSplitFile', ({ checkSplitFile }, cb) => {
            console.log("..................checkDoc called...........................")
            const criteria = {
                idpId: checkSplitFile.idpId,
                fileName: checkSplitFile.fileName,
                aiStatus: { $nin: [AI_STATUS.OCR_FAILED, AI_STATUS.OCR_DONE] },
                splitFileOcr: true
            }
            console.log("criteria:::::::::::criteria", criteria)
            documentService.findOne(criteria, {}, null, null, (e, r) => {
                console.log("..................checkDoc called...........................e,completed", e, (!r))
                if (e || (r)) {
                    return cb(e || "Some file parts pending");
                }
                console.log("send alert for large file competion")
                let apiTarget = "OCR"
                if (process.env.NODE_ENV_LABEL === "MARK_PROD" && checkSplitFile.tenantId && checkSplitFile.tenantId.toString() === "641a8d7c9285c7df7da42a6d") {
                    apiTarget = "QUEUE_SIZE_ALERT2"
                }
                sendEmail({
                    apiTarget,
                    subject: 'IDP | OCR | LARGE_FILE_OCR_COMPLETED',
                    body: `Large file (${checkSplitFile.fileOriginalName}) ocr completed`,
                }).then(() => { }).catch(() => { })
                cb(null, true)
            })
        }],
        Docs: ['checkDoc', ({ checkSplitFile }, cb) => {
            if (!checkSplitFile) {
                return cb()
            }
            const criteria = {
                idpId: checkSplitFile.idpId,
                fileName: checkSplitFile.fileName
            }
            documentService.findAll(criteria, { splitFilePageRange: 1 }, {}, cb)
        }],
        generateDocNumbers: ['Docs', ({ Docs }, cb) => {
            if (!Docs) {
                return cb()
            }
            const DocsObj = {
            }
            Docs.forEach(d => {
                if (DocsObj[d.splitFilePageRange]) {
                    DocsObj[d.splitFilePageRange].push(d)
                } else {
                    DocsObj[d.splitFilePageRange] = [d]
                }
            });
            const sortedRanges = Object.keys(DocsObj).sort((a, b) => {
                const aN = +a.split("___")[0]
                const bN = +b.split("___")[0]
                return aN - bN
            })
            console.log("sortedRangessortedRangessortedRanges:", sortedRanges)
            // sortedRanges.forEach
            let docNumber = 0
            eachSeries(sortedRanges, (range, ecb) => {
                const docs = DocsObj[range]
                eachSeries(docs, (d, escb) => {
                    docNumber += 1;
                    documentService.update({ _id: d._id }, { $set: { docNumber } }, null, escb)
                }, ecb)
            }, cb)
        }],
        deleteOldbackup: ['generateDocNumbers', ({ checkSplitFile }, cb) => {
            BACK_UP.deleteOne({ idpId: checkSplitFile.idpId }, cb) // backup will be auto generate on retry
        }],
        addNewBackUp: ['deleteOldbackup', ({ checkSplitFile }, cb) => { // Add new and updated backup with new generared doc numbers
            idpService.update({ _id: checkSplitFile.idpId }, { $set: { step: 0 } }, null, cb)
        }],
        pendingLargeFiles: (cb) => {
            documentService.findAll({ aiStatus: { $nin: [AI_STATUS.OCR_FAILED, AI_STATUS.OCR_DONE] }, splitFileOcr: true }, { _id: 1 }, null, cb)
        },
        downScale: ['pendingLargeFiles', ({ pendingLargeFiles }, cb) => {
            if (pendingLargeFiles && pendingLargeFiles.length) {
                console.log("pendingLargeFiles", pendingLargeFiles.length)
                console.log("skip down scaling split file servers")
                return cb()
            }
            autoScaleAiServers({ numberOfServers: 0, scalarType: "S_AWS_AUTO_SCALAR_GROUP_NAME" }, () => {
                console.log("downScale done for S_AWS_AUTO_SCALAR_GROUP_NAME", process.env['S_AWS_AUTO_SCALAR_GROUP_NAME'])
                cb()
            })
        }]
    }, (e) => {
        if (e) {
            console.log("generateDocNumbers ERROR:", e);
        }
        callback()
    })
}

/**
 * STEP 2 detected large file
 * @param {*} data
 * @param {*} callback
 */
const changeFileStatus = (user, { docId }, data, callback) => {
    auto({
        checkSplitFile: (cb) => {
            documentService.findOne({ _id: docId, splitFileOcr: true }, {}, null, null, (e, r) => {
                if (e || !r) {
                    cb(e || HTTP_ERROR_MESSAGES.FILE_UPLOAD.FILE_NOT_FOUND);
                }
                return cb(e, r)
            })
        },
        Docs: ['checkSplitFile', ({ checkSplitFile }, cb) => {
            let dataToSet = {}
            if (data.status === "APPROVED") {
                dataToSet = {
                    aiStatus: AI_STATUS.OCR_PENDING,
                    reason: "LARGE FILE PROCESSIING APPROVED",
                    ocrRetry: 0
                }
                generateSplitDocs(checkSplitFile.totalPages, checkSplitFile, cb)
            } else {
                dataToSet = {
                    aiStatus: AI_STATUS.OCR_FAILED,
                    reason: "LARGE FILE PROCESSIING REJECT",
                    ocrRetry: 0
                }
                documentService.updateAll({ _id: docId, idpId: checkSplitFile.idpId }, { $set: dataToSet }, null, cb)
            }
            const newPayload = {
                aiStatus: dataToSet.aiStatus,
                idpId: checkSplitFile.idpId,
                documentId: checkSplitFile._id,
                data: dataToSet
            }
            EMIT_EVENT('SAVE_LOG', { data: newPayload, from: 'LARGE_FILE_STATUS_CHANGE' });
        }],
        deleteBackUp: ["checkSplitFile", ({ checkSplitFile }, cb) => {
            BACK_UP.deleteOne({ idpId: checkSplitFile.idpId }, cb) // backup will be auto generate on retry
        }],
        updateBatch: ['Docs', ({ checkSplitFile }, cb) => {
            if (!checkSplitFile) {
                return cb()
            }
            idpService.update({ _id: checkSplitFile.idpId }, { $set: { step: 0 } }, null, cb)
        }]
    }, (e, { checkSplitFile }) => {
        if (e) {
            console.log("changeFileStatus ERROR:", e);
            return callback(e)
        }
        let apiTarget = "OCR"
        if (process.env.NODE_ENV_LABEL === "MARK_PROD" && checkSplitFile.tenantId && checkSplitFile.tenantId.toString() === "641a8d7c9285c7df7da42a6d") {
            apiTarget = "QUEUE_SIZE_ALERT2"
        }
        sendEmail({
            apiTarget,
            subject: 'IDP | OCR | LARGE_FILE_STATUS_CHANGED',
            body: `Large file (${checkSplitFile.fileOriginalName}) Status updated by: ${user.email} to ${data.status}`,
        }).then(() => { }).catch(() => { })
        callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}

const splitFileList = ({ tenantId }, { limit = 10, offset = 0, sortBy = 'createdAt', orderBy = 'ASC', aiStatus }, callback) => {
    const sortObj = {
        [sortBy]: orderBy === 'DESC' ? -1 : 1,
    };
    const criteria = { aiStatus: { $in: [AI_STATUS.OCR_PENDING, AI_STATUS.OCR_INPROGRESS, AI_STATUS.OCR_DONE, AI_STATUS.OCR_FAILED, AI_STATUS.OCR_RETRY] }, splitFileOcr: true }
    if (tenantId) {
        criteria.tenantId = createMongooseId(tenantId)
    }
    if (aiStatus) {
        criteria.aiStatus = aiStatus
    }
    const commonStages = [
        { $match: criteria },
        { $project: { aiStatus: 1, fileOriginalName: 1, fileName: 1, splitFilePageRange: 1 } },
        {
            $group: {
                _id: { fileName: "$fileName", splitFilePageRange: "$splitFilePageRange" },
                docs: {
                    $addToSet: {
                        aiStatus: "$aiStatus", fileOriginalName: "$fileOriginalName"
                    }
                },
            }
        },

    ]
    const stageCount = [...commonStages, { $group: { _id: null, count: { $sum: 1 } } }]
    auto({
        listSplitFiles: (cb) => {
            const stages = [
                ...commonStages,
                { $sort: sortObj },
                { $skip: offset },
                { $limit: limit },
                { $replaceRoot: { newRoot: { $mergeObjects: ["$_id", { $arrayElemAt: ["$docs", 0] }] } } }
            ]
            console.log("Stage:", JSON.stringify(stages));
            documentService.aggregation(stages, cb);
        },
        countSplitFiles: (cb) => {
            documentService.aggregation(stageCount, (err, res) => {
                if (err || !(res && res[0])) {
                    return cb(null, 0)
                }
                const result = res && res[0];
                cb(null, result.count || 0)
            })
        }
    }, (e, { listSplitFiles, countSplitFiles }) => {
        if (e) {
            console.log("splitFileList ERROR:", e);
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: listSplitFiles, filesCount: countSplitFiles })
    })
}

module.exports = {
    createSplitFile,
    generateDocNumbers,
    changeFileStatus,
    splitFileList,
}
