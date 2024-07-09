const config = require('config');
const { auto } = require('async');
const { performance } = require('perf_hooks');

const DOCUMENT = require('../Models/document.model')
const IDP_BATCH = require('../Models/idp.model');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const { autoScaleAiServers } = require('../Utils/admin-dashboard.util')
const { createMongooseId } = require('../Utils/universal-functions.util');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
let lastUpdated = new Date()

const statistics = ({ tenantId }, { userId = null }, callback) => {
    const timeStamp = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 7))
    const $match = {}
    if (tenantId) {
        $match.tenantId = createMongooseId(tenantId)
    }
    if (userId) {
        $match.userId = createMongooseId(userId)
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
    callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { aiProcess: process.env.FILE_OCR, maintenance: process.env.MAINTENANCE, lastUpdated, keyValueExtactionRotatedImages: process.env.KEY_VALUE_EXTRACT_OCR } })
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
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { aiProcess: process.env.FILE_OCR, maintenance: process.env.MAINTENANCE, lastUpdated, keyValueExtactionRotatedImages: process.env.KEY_VALUE_EXTRACT_OCR } })
    }).catch((e) => {
        process.env.FILE_OCR = originalFileOcr
        console.error("SENDING MAIL ERROR:::", e)
        callback({ ...HTTP_ERROR_MESSAGES.IMP_ERROR, message: "ERROR IN SENDING MAIL. PLEASE TRY AGAIN." })
    });
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

module.exports = {
    statistics,
    getUploadFilesAiStatus,
    setUploadFilesAiStatus,
    autoScaling,
    lastUpdated
};
