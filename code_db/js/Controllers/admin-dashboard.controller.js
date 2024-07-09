const config = require('config');
const { auto, eachSeries } = require('async');
const { performance } = require('perf_hooks');

const DOCUMENT = require('../Models/document.model')
const IDP_BATCH = require('../Models/idp.model');
const { documentService, idpService, tenantService } = require('../Services');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const { verifyDocumentCount } = require('../Utils/ocr.util')
const { autoScaleAiServers } = require('../Utils/admin-dashboard.util')
const { totalActiveServers, holdServer, getPortAndIp } = require('../Utils/load-balancer');
const { createMongooseId } = require('../Utils/universal-functions.util');
const BACK_UP = require('../Models/idp-documentlist-backup.model')
const BACKUP_DOCUMENT = require("../Models/backup-document.model") // save progress
const PAGE = require("../Models/page.model")
const PAGE_BACKUP = require('../Models/page-backup.model');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const AI_STATUS = config.get('AI_STATUS');
let lastUpdated = new Date()
let lastUpdatedTenantdt = new Date();
let lastUpdatedTenant = "all"
const APP_EVENTS = config.get('APP_EVENTS');

const _documentList = (criteria, callback) => {
    // console.log("_documentList_documentList_documentList: ", JSON.stringify(criteria))
    DOCUMENT.aggregate([
        ...criteria,
        {
            $lookup: {
                from: "users",
                localField: "createdBy",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $lookup: {
                from: "workflows",
                localField: "configId",
                foreignField: "_id",
                as: "workflow"
            }
        },
        {
            $lookup: {
                from: "idps",
                localField: "idpId",
                foreignField: "_id",
                as: "batch"
            }
        },
        {
            $project:
            {
                _id: 1, fileOriginalName: 1, fileName: 1, createdAt: 1, ocrRequestTime: 1, ocrResponseTime: 1, ocrUrl: 1, keyExtractRequestTime: 1, classification: 1, ocrClassification: 1, keyExtracted: 1, pdfMerged: 1, keyExtractResponseTime: 1, externalCustomerId: 1, totalPages: 1, failedStage: 1, ocrResponseInMs: 1, splitFilePageRange: 1, "user": { $arrayElemAt: ["$user", 0] }, workflow: { $arrayElemAt: ["$workflow", 0] }, batch: { $arrayElemAt: ["$batch", 0] }
            }
        },
        { $project: { _id: 1, fileOriginalName: 1, fileName: 1, createdAt: 1, ocrRequestTime: 1, ocrResponseTime: 1, ocrUrl: 1, keyExtractRequestTime: 1, classification: 1, ocrClassification: 1, keyExtracted: 1, pdfMerged: 1, keyExtractResponseTime: 1, externalCustomerId: 1, totalPages: 1, failedStage: 1, ocrResponseInMs: 1, splitFilePageRange: 1, "user.email": 1, "user.name": 1, "workflow.workflow": 1, "batch.name": 1, "workflow._id": 1, "batch._id": 1 } },
    ], callback)
}
const statistics = ({ tenantId = null, userId = null }, callback) => {
    const timeStamp = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 7))
    const $match = {}
    if (tenantId) {
        $match.tenantId = tenantId
    }
    if (userId) {
        $match.userId = userId
    }
    const startTime = performance.now()
    $match.createdAt = { $gte: new Date(timeStamp) }
    auto({
        totalBatches: (cb) => {
            IDP_BATCH.countDocuments($match, cb);
        },
        documentSummary: (cb) => {
            const stages = []
            if (Object.keys($match).length) {
                stages.push({ $match })
            }
            const $group = {
                _id: null,
                totalDocuments: { $sum: 1 },
                avgOcrTimeExtract: { $avg: "$ocrTimeExtract" },
                avgConfidenceScore: { $avg: "$confidenceScore" },
                minOcrTimeExtract: { $min: "$ocrTimeExtract" },
                minConfidenceScore: { $min: "$confidenceScore" },
                maxOcrTimeExtract: { $max: "$ocrTimeExtract" },
                maxConfidenceScore: { $max: "$confidenceScore" },
                totalQc: { $sum: { $cond: ["$isQcDone", 1, 0] } },
                avgQc: { $avg: { $cond: ["$isQcDone", 1, 0] } },
                totalFeedbackApplied: { $sum: { $cond: ["$isFeedbackApplied", 1, 0] } },
                avgFeedbackApplied: { $avg: { $cond: ["$isFeedbackApplied", 1, 0] } },
                totalStorageUsed: { $sum: { "$toDouble": "$fileSize" } }
            }
            stages.push({ $group })
            DOCUMENT.aggregate(stages, (err, res = []) => {
                if (err) {
                    return []
                }
                cb(null, res[0])
            })
        },
        documentsaiStatus: (cb) => {
            const stages = []
            if (Object.keys($match).length) {
                stages.push({ $match })
            }
            const $group = {
                _id: "$aiStatus",
                total: { $sum: 1 },
                avgOcrTimeExtract: { $avg: "$ocrTimeExtract" },
                avgConfidenceScore: { $avg: "$confidenceScore" },
                minOcrTimeExtract: { $min: "$ocrTimeExtract" },
                minConfidenceScore: { $min: "$confidenceScore" },
                maxOcrTimeExtract: { $max: "$ocrTimeExtract" },
                maxConfidenceScore: { $max: "$confidenceScore" }
            }
            stages.push({ $group })
            DOCUMENT.aggregate(stages, (err, res) => {
                if (err) {
                    return []
                }
                const status = { OCR_PENDING: { total: 0 } }
                res.forEach(e => {
                    const item = { ...e, stage: e._id }
                    delete item._id
                    status[item.stage] = item
                })
                cb(null, status)
            })
        },
        documentClassificationStatus: (cb) => {
            const stages = []
            const criteria = { ...$match, classification: { $in: ["STARTED", "RETRY"] } }
            stages.push({ $match: criteria })
            const $group = {
                _id: "$classification",
                total: { $sum: 1 }
            }
            stages.push({ $group })
            DOCUMENT.aggregate(stages, (err, res) => {
                if (err) {
                    return []
                }
                const status = { OCR_PENDING: { total: 0 } }
                res.forEach(e => {
                    const item = { ...e, stage: e._id }
                    delete item._id
                    status[item.stage] = item
                })
                cb(null, status)
            })
        },
        documentInProgress: (cb) => {
            return cb();
            _documentList([
                { $match: { aiStatus: AI_STATUS.OCR_INPROGRESS } },
                { $limit: 20 }
            ], cb)
        },
        documentsInQueue: (cb) => {
            return cb()
            _documentList([
                { $match: { aiStatus: AI_STATUS.OCR_PENDING } },
                { $limit: 20 }], cb)
        },
        documentsLastFailed: (cb) => {
            return cb()
            _documentList([{ $match: { aiStatus: AI_STATUS.OCR_FAILED } }, { $sort: { createdAt: -1 } }, { $limit: 20 }], cb)
        }
    },
        (err, { totalBatches = 0, documentSummary = {}, ...rest }) => {
            const endTime = performance.now()
            delete documentSummary._id
            callback(null,
                {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    data: {
                        totalBatches,
                        documentSummary,
                        timeConsumed: parseInt((endTime - startTime).toFixed(2), 10),
                        ...rest
                    }
                })
        })
}

const getUploadFilesAiStatus = (_, callback) => {
    callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { aiProcess: process.env.FILE_OCR, maintenance: process.env.MAINTENANCE, lastUpdated, keyValueExtactionRotatedImages: process.env.KEY_VALUE_EXTRACT_OCR, lastUpdatedTenant, lastUpdatedTenantdt, autoSchedular: process.env.AUTO_SCHEDULAR_AI_SERVERS } })
}

const setUploadFilesAiStatus = (request, { aiProcess }, callback) => {
    const originalFileOcr = process.env.FILE_OCR
    process.env.FILE_OCR = aiProcess
    lastUpdated = new Date()
    const ip = request.headers['x-real-ip'] || request.info.remoteAddress;
    const email = request.auth.credentials.user.email || "email not found"
    const html = `File Processing status updated by email: ${email} | ip: ${ip}. Updated to ${aiProcess}`
    ImcAPIEndPoints.sendEmail({
        subject: `AI PROCESSING STATUS UPDATED`,
        body: html,
        apiTarget: 'OCR'
    }).then(() => {
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { aiProcess: process.env.FILE_OCR, maintenance: process.env.MAINTENANCE, lastUpdated, keyValueExtactionRotatedImages: process.env.KEY_VALUE_EXTRACT_OCR, autoSchedular: process.env.AUTO_SCHEDULAR_AI_SERVERS } })
    }).catch((e) => {
        process.env.FILE_OCR = originalFileOcr
        console.error("SENDING MAIL ERROR:::", e)
        callback({ ...HTTP_ERROR_MESSAGES.IMP_ERROR, message: "ERROR IN SENDING MAIL. PLEASE TRY AGAIN." })
    });
}

const filesListing = (_, { aiStatus, classification, sortBy = "createdAt", offset = 0, orderBy, limit = 20 }, callback) => {
    const before7days = new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 7)
    let criteria = { aiStatus }
    const sortObj = {
        [`file.${sortBy}`]: orderBy === 'DESC' ? -1 : 1,
    };
    let replaceRoot = { $replaceRoot: { newRoot: { $mergeObjects: ["$$ROOT", { $arrayElemAt: ["$file", 0] }] } } }
    if (aiStatus === "OCR_COMPLETE") {
        replaceRoot = { $replaceRoot: { newRoot: { $mergeObjects: ["$$ROOT", { $arrayElemAt: ["$file", 0] }, { totalPages: "$totalPages" }] } } }
    }

    const fileStages = [
        {
            $group: {
                _id: { fileName: "$fileName", splitFilePageRange: "$splitFilePageRange" },
                file: { $addToSet: "$$ROOT" },
                ocrResponseInMs: {
                    $sum: {
                        $dateDiff: {
                            startDate: "$ocrRequestTime",
                            endDate: "$ocrResponseTime",
                            unit: "millisecond"
                        }
                    }
                },
                totalPages: { $sum: "$docTotalPages" },
            }
        },
        { $sort: sortObj },
        { $skip: offset },
        { $limit: limit },
        replaceRoot
    ]
    if (classification) {
        if (classification === "STARTED") {
            criteria = { classification: { $in: ["STARTED", "RETRY"] } }
        }
        if (classification === "IN_PROGRESS") {
            criteria = { ocrClassification: { $in: ['IN_PROGRESS', 'WITHOUT_OCR_IN_PROGRESS'] } }
        }
    }
    if (aiStatus === "OCR_FAILED" || (classification && classification === "STARTED")) {
        fileStages.shift() // remove grouping
        fileStages.shift() // remove sorting
        fileStages.pop() // remove file functionality
        fileStages.pop() // remove file functionality
        fileStages.push({ $sort: { ocrResponseTime: -1 } })
        fileStages.push({ $skip: offset })
        fileStages.push({ $limit: limit })
    }
    if (aiStatus === "OCR_PENDING") {
        criteria = { $or: [{ aiStatus }, { ocrClassification: 'PENDING' }] }
    }
    criteria.createdAt = { $gte: before7days }
    auto({
        filesCount: (cb) => {
            const countStages = [
                { $match: criteria },
                { $group: { _id: "$fileName", file: { $addToSet: "$$ROOT" } } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 }
                    }
                }
            ]
            documentService.aggregation(countStages, (err, res) => {
                if (err || !(res && res[0])) {
                    return cb(null, 0)
                }
                const result = res && res[0];
                cb(null, result.count || 0)
            })
        },
        files: (cb) => {
            _documentList([{ $match: criteria }, ...fileStages], cb)
        }
    }, (e, { files, filesCount }) => {
        if (e) {
            console.log("files list on superadmin error:", e)
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: files || [], filesCount })
    })
}

const fileUpdate = (_, { fileId: docId, aiStatus, ipAddress }, callback) => {
    let dataToSet = {
        ip: ipAddress
    }
    auto({
        file: (cb) => {
            documentService.findOne({ _id: docId }, { _id: 1, idpId: 1, fileName: 1, failedStage: 1 }, null, null, cb)
        },
        // deleteExtractedDoc: ['file', ({ file }, cb) => {
        //     return cb();
        //     // documentService.deleteMany({ idpId: file.idpId, fileName: file.fileName, _id: { $nin: [file._id] } }, cb)
        // }],
        changeDocStatus: ['file', ({ file }, cb) => {
            // todo check failed files only
            if (file.failedStage === "ROTATE_JPG") {
                dataToSet = {
                    aiStatus: "OCR_COMPLETE",
                    classification: "STARTED", // send for image rotator
                    keyValueExtract: false
                }
                process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED';
            } else if (file.failedStage === "PDF_GENERATOR") {
                dataToSet = {
                    aiStatus: "OCR_COMPLETE",
                    classification: "STARTED", // send for image rotator
                    keyValueExtract: true
                }
                process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED';
            } else {
                dataToSet = {
                    aiStatus,
                    pdfMerged: false,
                    keyExtracted: false,
                    classification: "NOT_REQUIRED"
                }
            }
            dataToSet = {
                ...dataToSet,
                pdfMerged: false,
                ocrRetry: 0
            }
            console.log("DATA TO SET fileUpdate", dataToSet)
            documentService.update({ _id: file._id }, { $set: dataToSet }, null, cb);
        }],
        updateBatch: ['file', ({ file }, cb) => {
            dataToSet.idpId = file.idpId
            idpService.update({ _id: file.idpId }, { $set: { step: 0, ocrStatus: "PENDING", qcStatus: "PENDING" } }, null, cb)
        }]
    }, () => {
        EMIT_EVENT("SUPER_ADMIN_REFRESH", { opType: "REFRESH", type: "SUPER_ADMIN_REFRESH" });
        EMIT_EVENT('SAVE_LOG', { data: dataToSet, from: 'fileUpdate' });
        callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}
/**
 * Auto scale ai servers
 * @param {*} user
 * @param {*} payload
 * @param {*} callback
 */
const autoScaling = (user, { numberOfServers, scalarType = "AWS_AUTO_SCALAR_GROUP_NAME" }, callback) => {
    console.log("autoScaling:", numberOfServers)
    auto({
        scale: (cb) => {
            autoScaleAiServers({ numberOfServers, scalarType }, cb)
        }
    }, (e) => {
        if (e) {
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, message: `Schedular auto scaled to numberOfServers ${numberOfServers} ` })
    })
}
// 7 am CST it should set to 4,
// 12 PM cst it should set to 5,
// 5 pm CST it should set to 4 again and
// 7 pm cst it should set to 1
// monday to friday
const scheduleArray = [
    { scheduleTime: "07:00", days: [1, 2, 3, 4, 5], numberOfServers: 5, lastScheduledAt: null },
    { scheduleTime: "19:00", days: [1, 2, 3, 4, 5], numberOfServers: 0, lastScheduledAt: null },
]
const autoScheduler = ({ hours, minutes, currentDay }, callback) => {
    // disabled auto schedular
    return callback()
    const currentTime = `${+hours}:${+minutes}`
    const arraySelected = scheduleArray.filter(e => (!e.lastScheduledAt || e.lastScheduledAt !== currentTime));
    eachSeries(arraySelected, (s, cb) => {
        const { numberOfServers, scheduleTime, days } = s
        const h = scheduleTime.split(":")[0]
        const m = scheduleTime.split(":")[1]
        if ((+h) === (+hours) && (+m) === (+minutes) && days.includes(+currentDay)) {
            autoScaling({}, { numberOfServers }, cb)
        } else {
            cb()
        }
        s.lastScheduledAt = currentTime
    }, callback)
}

/**
 * Disable processign for other tenants except tenantName
 * @param {*} request
 * @param {*} param1
 * @param {*} callback
 */
const setProcessingForTenant = (request, { tenantName, autoSchedular = "NONE" }, callback) => {
    auto({
        tenant: (cb) => {
            if (tenantName === 'all') {
                return cb()
            }
            tenantService.findOne({ name: tenantName }, {}, {}, cb)
        }
    }, (e, { tenant }) => {
        if (e) {
            return callback(e)
        }
        if (tenantName !== 'all' && (!tenant || !tenant._id)) {
            return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Invalid tenant" })
        }
        if (tenantName === 'all') {
            process.env.SINGLE_TENANT_ID = '';
        } else {
            process.env.SINGLE_TENANT_ID = tenant._id
        }
        // TODO REMOVE THIS SECTION on using api query param
        if (autoSchedular === 'NONE') {
            if (tenantName === "sowmya") {
                autoSchedular = "DISABLED"; // disable schedular on file filteration for sowyma helpful in mark prod
            } else {
                autoSchedular = "ENABLED"
            }
        }
        if (autoSchedular !== 'NONE') {
            process.env.AUTO_SCHEDULAR_AI_SERVERS = autoSchedular
        }
        lastUpdatedTenant = tenantName
        lastUpdatedTenantdt = new Date()
        const ip = request.headers['x-real-ip'] || request.info.remoteAddress;
        const email = request.auth.credentials.user.email || "email not found"
        const html = `File Processing status updated by email: ${email} | ip: ${ip}. Files from only "${tenantName}" will get processed`
        ImcAPIEndPoints.sendEmail({
            subject: `AI PROCESSING ENABLED FOR ${tenantName}`,
            body: html,
            apiTarget: 'OCR'
        }).then(() => {
            callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { aiProcess: process.env.FILE_OCR, maintenance: process.env.MAINTENANCE, lastUpdated, keyValueExtactionRotatedImages: process.env.KEY_VALUE_EXTRACT_OCR, lastUpdatedTenant, lastUpdatedTenantdt } })
        }).catch((e) => {
            console.error("SENDING MAIL ERROR:::", e)
            callback({ ...HTTP_ERROR_MESSAGES.IMP_ERROR, message: "ERROR IN SENDING MAIL. PLEASE TRY AGAIN." })
        });
    })
}
// Let’s adjust the table to:
// 0-100 5,
// 100-200 6,
// 200-300 8,
// 300-400 10,
// 400-500, 11,
//  500 + 12, 900 + 17

const serverMapping = [
    {
        range: {
            l: 0, u: 100,
        },
        servers: 5,
    },
    {
        range: {
            l: 101, u: 200,
        },
        servers: 6
    },
    {
        range: {
            l: 201, u: 300,
        },
        servers: 8,
    },
    {
        range: {
            l: 301, u: 400,
        },
        servers: 10,
    },
    {
        range: {
            l: 401, u: 500,
        },
        servers: 12,
    },
    {
        range: {
            l: 501, u: 900,
        },
        servers: 12,
    },
    {
        range: {
            l: 901, u: 1000000,
        },
        servers: 17,
    }
]
const getServer = ({ filesCount }, callback) => {
    const s = serverMapping.find(s => {
        const range = s.range;
        if (filesCount >= range.l && filesCount <= range.u) {
            return true
        }
        return false
    })
    callback(null, s)
}
let lastUpScaleCheck = new Date();
let lastDownScaleCheck = new Date()
let lastActiveServerCount = null
const isWorkingHour = ({ hours, currentDay }) => {
    const workingDays = [1, 2, 3, 4, 5]
    if (!(workingDays.includes(+currentDay))) {
        return false
    }
    // working time is 7am to 7pm
    if ((+hours) >= 7 && (+hours) < 19) {
        return true
    }
    return false
}
const upscaleServerCheck = ({ filesCount, hours, minutes, currentDay }) => {
    // serverMapping
    console.log("........upscale called....... lastActiveServerCount: ", lastActiveServerCount)
    console.log("filesCount, hours, minutes, currentDay ", filesCount, hours, minutes, currentDay)
    const lastServerCheck = new Date(lastUpScaleCheck.getTime() + (1000 * 60 * 5)).getTime();
    if (lastServerCheck > new Date().getTime()) { // check only after 5 minutes
        return
    }
    lastUpScaleCheck = new Date() // stops immediate calls for current method beyond this
    console.log("........................start upscale.......................filesCount: ", filesCount);
    auto({
        serversUpCount: (cb) => {
            if (lastActiveServerCount == null) {
                lastActiveServerCount = totalActiveServers();
            }
            cb()
        },
        getServerRange: ['serversUpCount', (_, cb) => {
            getServer({ filesCount }, (e, s) => {
                console.log("getServerRange", s)
                cb(null, s)
            })
        }],
        checkUpscale: ["getServerRange", ({ getServerRange }, cb) => {
            let serverCount = 0
            if (!getServerRange) {
                return cb()
            }
            console.log('lastActiveServerCount', lastActiveServerCount)
            console.log('getServerRange.servers', getServerRange.servers)
            if (lastActiveServerCount > getServerRange.servers) {
                // down scale
                const lastDownScaleRun30min = lastDownScaleCheck && new Date(lastDownScaleCheck.getTime() + (1000 * 60 * 30)).getTime()
                console.log("lastDownScaleCheck", lastDownScaleCheck);
                console.log("lastDownScaleRun30min", lastDownScaleRun30min);
                console.log("new Date().getTime()", new Date().getTime());
                if (lastDownScaleRun30min && lastDownScaleRun30min > new Date().getTime()) {
                    return cb()
                }
                serverCount = getServerRange.servers
                if (filesCount < 50) {
                    console.log('files count < 50 continuing with downscale')
                } else {
                    console.log('skipping downscale coz fileCount > 50', filesCount)
                    return cb()
                }
            }
            if (lastActiveServerCount < getServerRange.servers) {
                // up scale now
                serverCount = getServerRange.servers
            }
            if (getServerRange.servers === 5) {
                if (!isWorkingHour({ hours, minutes, currentDay })) {
                    console.log('not working hour')
                    serverCount = 1
                } else {
                    console.log('working hour')
                    serverCount = getServerRange.servers
                }
            }
            console.log("autoScaling isWorkingHour", getServerRange.servers, serverCount)
            if (serverCount === 0 || lastActiveServerCount === serverCount) {
                console.log('neither up nor down')
                return cb();
            }
            // if (lastActiveServerCount === serverCount) {
            //     // do nothing
            //     return cb()
            // }
            autoScaling({}, { numberOfServers: serverCount }, (e) => {
                if (e) {
                    console.log("autoScaling error:", e)
                    return cb()
                }
                const res = {
                    lastServerCount: lastActiveServerCount,
                    newServerCount: serverCount,
                    filesCount
                }
                lastUpScaleCheck = new Date();
                lastDownScaleCheck = new Date()
                lastActiveServerCount = serverCount
                return cb(null, res)
            })
        }]
    }, (e, { checkUpscale }) => {
        if (checkUpscale) {
            let apiTarget = "OCR"
            if (process.env.NODE_ENV_LABEL === "MARK_PROD") {
                apiTarget = "QUEUE_SIZE_ALERT2"
            }
            ImcAPIEndPoints.sendEmail({
                apiTarget,
                subject: `SERVER AUTO SCHEDULAR UPDATE | ${process.env.NODE_ENV_LABEL}`,
                body: JSON.stringify(checkUpscale)
            }).then(() => { }).catch(() => { })
        }
        console.log("END PROCESS upscaleServerCheck", lastActiveServerCount)
    })
}
const tenants = (_, callback) => {
    tenantService.findAll({}, (e, data) => {
        if (e) {
            return callback(e);
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data })
    })
}


/** Reprocess file ocr */
const reprocessFileOcr = (file, callback) => {
    auto({
        deleteOtherDocs: (cb) => {
            const criteria = {
                idpId: file.idpId,
                fileName: file.fileName,
                _id: { $nin: [createMongooseId(file._id)] }
            }
            console.log("DELETE criteria", criteria)
            documentService.deleteMany(criteria, cb)
        },
        changeDocStatus: (cb) => {
            const dataToSet = {
                docType: null,
                aiDocType: null,
                addressId: null,
                aiUniqueId: null,
                aiStatus: "OCR_PENDING",
                qcStatus: "PENDING",
                pdfMerged: false,
                keyExtracted: false,
                classification: "NOT_REQUIRED",
                ocrClassification: "NOT_REQUIRED",
                ocrRetry: 0,
                reviewedBy: null,
                reviewedAt: null,
                classifiedAt: null,
                classifiedBy: null,
                reviewedAcceptedBy: null,
                reviewedAcceptedAt: null,
                classifiedAcceptedAt: null,
                classifiedAcceptedBy: null,
                filesMerged: [],
                corruptFile: false,
                totalPages: 0,
                docNumber: 1,
                pageArray: [],
                ocrTimeExtract: 0,
                splitFilePageRange: null,
                splitFileOcr: false,
                pageRange: ""
            }
            documentService.update({ _id: file._id }, { $set: dataToSet }, null, cb);
        },
        deleteSaveProgress: (cb) => {
            BACKUP_DOCUMENT.deleteMany({ documentId: file._id }, cb)
        }
    }, callback)
}

const hardResetBatch = (payload, callback) => {
    auto({
        fetchBackup: (cb) => {
            BACK_UP.findOne({ idpId: payload.idpId }, cb)
        },
        deleteFileDocuments: ['fetchBackup', ({ fetchBackup }, cb) => {
            if (!fetchBackup) {
                return cb()
            }
            documentService.deleteMany({ idpId: payload.idpId }, cb)
        }],
        createDocuments: ['fetchBackup', 'deleteFileDocuments', ({ fetchBackup }, cb) => {
            if (!fetchBackup) {
                return cb()
            }
            documentService.createMany(fetchBackup.documents, cb)
        }],
    }, callback)
}

const reprocessBatch = (request, { idpId, fileName, ipAddress }, callback) => {
    const { email, tenantId } = request.auth.credentials.user
    auto({
        checkBatchCompleted: (cb) => {
            idpService.findOne({ _id: idpId }, {}, (e, batch) => {
                if (e) {
                    return cb(e);
                }
                if (batch) {
                    if (!batch.filesUploadedCount) {
                        return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "No file in batch" });
                    }
                    if (batch.qcStatus === "COMPLETED") {
                        return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Review ALready completed on Batch" });
                    }
                }
                return cb(null, batch)
            })
        },
        fialedDocs: (cb) => {
            const criteria = { idpId, aiStatus: AI_STATUS.OCR_FAILED };
            if (fileName) {
                criteria.fileName = fileName
            }
            documentService.findOne(criteria, { _id: 1 }, null, null, (e, file) => {
                if (file) {
                    return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Some files Are in Ocr failure" });
                }
                cb()
            })
        },
        hardResetNow: ['checkBatchCompleted', 'fialedDocs', (_, cb) => {
            hardResetBatch({ idpId }, cb)
        }],
        docs: ['hardResetNow', (_, cb) => {
            const criteria = { idpId };
            if (fileName) {
                criteria.fileName = fileName
            }
            documentService.findAll(criteria, { _id: 1, idpId: 1, fileName: 1, qcStatus: 1 }, null, cb)
        }],
        sendForReprocess: ['hardResetNow', 'docs', ({ docs }, cb) => {
            const batchFiles = {}
            docs.forEach(d => {
                if (!batchFiles[d.fileName]) {
                    batchFiles[d.fileName] = d
                }
            })
            eachSeries(Object.values(batchFiles), reprocessFileOcr, cb)
        }],
        updateBatch: ['sendForReprocess', (_, cb) => {
            const dataToSet = {
                step: 0,
                ocrStatus: "PENDING",
                qcStatus: "PENDING",
                filesCount: 0,
                ocrFailedCount: 0,
                ocrPassedCount: 0,
                identifiedCount: 0,
                nonIdentifiedCount: 0,
                qcCount: 0,
                processedPercent: 0,
                ocrResponseTime: null
            }
            idpService.update({ _id: idpId }, { $set: dataToSet }, null, cb)
        }],
        deletBackUp: ['sendForReprocess', (_, cb) => {
            BACK_UP.deleteMany({ idpId }, cb)// update({ _id: idpId }, { $set: { step: 0, ocrStatus: "PENDING", qcStatus: "PENDING" } }, null, cb)
        }],
        deletePages: ['sendForReprocess', (_, cb) => {
            PAGE.deleteMany({ idpId }, cb)
        }],
        deletePagesBackup: ['sendForReprocess', (_, cb) => {
            PAGE_BACKUP.deleteMany({ idpId }, cb)
        }],
        removeSavedDocs: ['sendForReprocess', (_, cb) => {
            BACKUP_DOCUMENT.deleteMany({ "document.idpId": idpId }, cb); // remove auto save data
        }]
    }, (e, { checkBatchCompleted }) => {
        let message = `Batch reprocessed by ${email} <br>
         Batch Number: ${checkBatchCompleted && checkBatchCompleted.name} <br>
         BatchId: ${idpId}<br>
         Ip: ${ipAddress}<br>`
        if (e) {
            message += `<br>error${e && e.message}`
            return callback(e)
        }
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, batchId: idpId, eventType: "BATCH_REPROCESSED" });
        EMIT_EVENT("SUPER_ADMIN_REFRESH", { opType: "REFRESH", type: "SUPER_ADMIN_REFRESH" });
        EMIT_EVENT('SAVE_LOG', { data: { idpId, fileName, createdBy: email, ip: ipAddress }, from: 'fileUpdate' });
        ImcAPIEndPoints.sendEmail({
            subject: 'OCR | REPROCESS BATCH',
            body: message,
            apiTarget: 'OCR'
        }).then(() => {
            console.log("EMAIL SENT")
        }).catch((e) => {
            console.log("EMAIL FAILED TO SENT", e)
        });
        callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}

const holdServerOnDisallowFlag = (data) => {
    console.log("holdServerOnDisallowFlag: holdServerOnDisallowFlag: ", data)
    if (!data || !data.doc_id) {
        return
    }
    auto({
        server: (cb) => {
            documentService.findOne({ _id: data.doc_id }, { ocrUrl: 1 }, null, null, cb)
        },
        changeServerStatus: ['server', ({ server }, cb) => {
            if (!server) {
                return cb()
            }
            const { ip } = getPortAndIp(server.ocrUrl)
            holdServer(ip)
            cb(null, ip)
        }]
    }, (e, { changeServerStatus }) => {
        console.log("changeServerStatus e, ip", e, changeServerStatus)
    })
}
process.on("DISALLOW_FLAG", (payload) => {
    console.log("LISTEN EVENT DISALLOW_FLAG ", payload)
    holdServerOnDisallowFlag(payload.data)
})

const retryInProgressFile = (data) => {
    auto({
        checkFileOcr: (cb) => {
            filesListing(null, { aiStatus: "OCR_INPROGRESS", offset: 0, limit: 100 }, cb)
        },
        inprogressFiles: ['checkFileOcr', ({ checkFileOcr }, cb) => {
            let files = []
            if (checkFileOcr && checkFileOcr.filesCount) {
                files = files.concat(checkFileOcr.data)
            }
            files = files.filter(f => f.ocrUrl.includes(data.ip))
            if (files[0]) {
                return cb(null, files)
            }
            cb("No file in progress for data")
        }],
        forceFailure: ['checkFile', ({ inprogressFiles }, cb) => {
            eachSeries(inprogressFiles, (file, ecb) => {
                fileUpdate(null, { fileId: file._id, aiStatus: "OCR_FAILED", ipAddress: "SYSTEM" }, ecb)
            }, cb)
        }],
        retryFile: ["forceFailure", (_, cb) => { cb() }]
    })
}
process.on("FORCE_FAILURE_FILE_ON_BUSY_TO_UNREACHABLE", (payload) => {
    console.log("FORCE_FAILURE_FILE_ON_BUSY_TO_UNREACHABLE", payload)
})
module.exports = {
    statistics,
    getUploadFilesAiStatus,
    setUploadFilesAiStatus,
    filesListing,
    fileUpdate,
    lastUpdated,
    autoScaling,
    autoScheduler,
    setProcessingForTenant,
    upscaleServerCheck,
    tenants,
    reprocessBatch
};
