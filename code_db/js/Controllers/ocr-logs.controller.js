const config = require('config');
const moment = require('moment');
const { auto, eachSeries } = require('async')
const ObjectId = require('mongoose').Types.ObjectId;
const OCR_LOGS = require('../Models/logs.model');
const { createMongooseId } = require('../Utils/universal-functions.util');
const { workflowService, idpService, documentService } = require('../Services');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const isValidMongooseId = ObjectId.isValid

const ocrLogsFetch = ({ tenantId }, queryParams = {}, hcb) => {
    const limit = queryParams.limit || 10;
    const skip = queryParams.offset || 0;
    const sort = {
        [queryParams.sortBy]: queryParams.orderBy === 'DESC' ? -1 : 1,
    };
    const findQuery = { tenantId: createMongooseId(tenantId) }
    if (queryParams.ipAddress) {
        findQuery.ipAddress = queryParams.ipAddress;
    }
    if (queryParams.workflowId) {
        findQuery.idpId = createMongooseId(queryParams.idpId);
    }
    if (queryParams.uploadedFrom || queryParams.uploadedTo) {
        findQuery.createdAt = {}
        if (queryParams.uploadedFrom) {
            findQuery.createdAt["$gte"] = moment(queryParams.uploadedFrom).toDate();
        }
        if (queryParams.uploadedTo) {
            findQuery.createdAt["$lt"] = moment(queryParams.uploadedTo).add(1, 'days').toDate();
        }
    }
    if (queryParams.workflowId) {
        findQuery.idpId = createMongooseId(queryParams.idpId);
    }
    if (queryParams.statusCode) {
        findQuery.statusCode = queryParams.statusCode
    }
    const queryLogs = [{ $match: { ...findQuery, } }]
    queryLogs.push({
        $lookup: {
            from: 'workflows',
            localField: 'workflowId',
            foreignField: '_id',
            as: 'workflow',
        }
    })
    queryLogs.push({
        $lookup: {
            from: 'documents',
            localField: 'idpId',
            foreignField: 'idpId',
            as: 'document',
        }
    })
    queryLogs.push({ $unwind: { path: '$workflow', preserveNullAndEmptyArrays: true } })
    queryLogs.push({ $unwind: { path: '$document', preserveNullAndEmptyArrays: true } })

    queryLogs.push({
        $project: {
            endpoint: 1,
            method: 1,
            payload: 1,
            error: 1,
            requestTime: 1,
            responseTime: 1,
            statusCode: 1,
            ipAddress: 1,
            idpId: 1,
            externalId: 1,
            "workflow._id": 1,
            "workflow.workflow": 1,
            "response": 1,
            "document.status": "$document.aiStatus",
            "document.fileOriginalName": 1,
            "document.ocrRequestTime": 1,
            "document.ocrResponseTime": 1,
            "document.pageArray.pageNo": 1,
            "document.pageArray.pageImageLink": 1,
            "document.pageArray.dimension": 1,
            "document.pageArray.nonTabularContent.confidence_score": 1,
            "document.pageArray.nonTabularContent.global_key": 1,
            "document.pageArray.nonTabularContent.data_type": 1,
            "document.pageArray.nonTabularContent.mandatory": 1,
            "document.nonTabularContent.local_value.text": 1,
            "document.pageArray.nonTabularContent.local_value.pts": 1,
            "document.createdAt": 1,
            "document.updatedAt": 1,
            "document.confidenceScore": 1,
            apiResolveTime: { $subtract: ['$responseTime', '$requestTime'] },
            createdAt: 1
        }
    })
    // queryLogs.push({
    //     $project: {
    //         "response.pageArray": 0,
    //     }
    // })
    queryLogs.push({
        $facet: {
            logs: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
            count: [
                {
                    $group: {
                        count: { $sum: 1 },
                        _id: null,
                    },
                },
            ]
        }
    })
    console.log("QYERY queryLogsqueryLogs1", JSON.stringify(queryLogs))
    OCR_LOGS.aggregate(queryLogs, (err, result) => {
        if (err) {
            return hcb(err)
        }
        const { logs: data, count } = result[0];

        hcb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data,
            totalCount: count[0] && count[0].count ? count[0].count : 0
        })
    })
};

const ocrLogsFetchMark = ({ tenantId }, queryParams = {}, hcb) => {
    const limit = queryParams.limit || 10;
    const skip = queryParams.offset || 0;
    const sort = {
        [queryParams.sortBy]: queryParams.orderBy === 'DESC' ? -1 : 1,
    };
    let findQuery = { tenantId: createMongooseId(tenantId) }
    if (queryParams.q) {
        findQuery.ipAddress = queryParams.q;
    }
    if (queryParams.workflowId) {
        findQuery.idpId = createMongooseId(queryParams.idpId);
    }
    if (queryParams.uploadedFrom || queryParams.uploadedTo) {
        findQuery.createdAt = {}
        if (queryParams.uploadedFrom) {
            findQuery.createdAt["$gte"] = moment(queryParams.uploadedFrom).toDate();
        }
        if (queryParams.uploadedTo) {
            findQuery.createdAt["$lt"] = moment(queryParams.uploadedTo).add(1, 'days').toDate();
        }
    }
    if (queryParams.workflowId) {
        findQuery.idpId = createMongooseId(queryParams.idpId);
    }
    if (queryParams.statusCode) {
        findQuery.statusCode = queryParams.statusCode
    }
    auto({
        batch: (cb) => {
            if (!queryParams.q) {
                return cb();
            }
            const batchNumber = queryParams.q.match(/(\d+)/)
            if (!batchNumber || queryParams.q.includes(".")) {
                return cb();
            }
            const batch = `Batch_${batchNumber[0]}`;
            idpService.findAll({ tenantId, name: batch }, { _id: 1 }, null, (e, r) => {
                if (r) {
                    findQuery = { tenantId: createMongooseId(tenantId), idpId: { $in: r.map(b => createMongooseId(b._id)) } }
                }
                cb()
            })
        },
        logsCount: ['batch', (_, cb) => {
            OCR_LOGS.countDocuments(findQuery, cb)
        }],
        logs: ['batch', (_, cb) => {
            console.log("findQueryfindQuery:", findQuery)
            OCR_LOGS.find(findQuery)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(true)
                .exec(cb)
        }],
        mapData: ['logs', ({ logs }, cb) => {
            eachSeries(logs, (log, ecb) => {
                auto({
                    workflow: (acb) => {
                        return acb()
                        if (!log.workflowId && !isValidMongooseId(log.workflowId)) {
                            log.workflow = null
                            return acb()
                        }
                        workflowService.findOne({ _id: log.workflowId }, { workflow: 1 }, null, null, (err, workflow) => {
                            log.workflow = workflow
                            acb()
                        })
                    },
                    batch: (acb) => {
                        if (!log.idpId && !isValidMongooseId(log.idpId)) {
                            return acb()
                        }
                        idpService.findOne({ _id: log.idpId }, { ocrStatus: 1, name: 1 }, null, null, (err, batch) => {
                            acb(null, batch)
                        })
                    },
                    documents: (acb) => {
                        return acb(null, [])
                        if (!log.idpId && !isValidMongooseId(log.idpId)) {
                            return acb(null, [])
                        }
                        documentService.findAll({ idpId: log.idpId }, {
                            "aiStatus": 1,
                            "fileOriginalName": 1,
                            "ocrRequestTime": 1,
                            "ocrResponseTime": 1,
                            "pageArray.pageNo": 1,
                            "pageArray.pageImageLink": 1,
                            "pageArray.dimension": 1,
                            "pageArray.nonTabularContent.confidence_score": 1,
                            "pageArray.nonTabularContent.global_key": 1,
                            "pageArray.nonTabularContent.data_type": 1,
                            "pageArray.nonTabularContent.mandatory": 1,
                            "pageArray.nonTabularContent.local_value.text": 1,
                            "pageArray.nonTabularContent.local_value.pts": 1,
                            "createdAt": 1,
                            "updatedAt": 1,
                            "confidenceScore": 1
                        }, { limit: 10 }, (err, documents) => {
                            log.documents = documents || []
                            acb(null, null)
                        })
                    },
                    addFields: ['batch', ({ batch }, acb) => {
                        if (batch) {
                            log.status = batch.ocrStatus === "PENDING" ? "OCR_PENDING" : "OCR_COMPLETE"
                            log.batchName = batch.name
                        } else {
                            log.status = "OCR_FAILED";
                        }
                        if (log.responseTime && log.requestTime) {
                            log.apiResolveTime = (new Date(log.responseTime).getTime()) - (new Date(log.requestTime).getTime());
                        }
                        acb()
                    }]
                }, ecb)
            }, cb)
        }]
    }, (err, { logsCount, logs }) => {
        if (err) {
            return hcb(err)
        }
        hcb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: logs,
            totalCount: logsCount
        })
    })
}

// const ocrLogsFetchMark = ({ tenantId }, queryParams = {}, hcb) => {
//     const limit = queryParams.limit || 10;
//     const skip = queryParams.offset || 0;
//     const sort = {
//         [queryParams.sortBy]: queryParams.orderBy === 'DESC' ? -1 : 1,
//     };
//     const findQuery = { tenantId: createMongooseId(tenantId) }
//     if (queryParams.ipAddress) {
//         findQuery.ipAddress = queryParams.ipAddress;
//     }
//     if (queryParams.workflowId) {
//         findQuery.idpId = createMongooseId(queryParams.idpId);
//     }
//     if (queryParams.uploadedFrom || queryParams.uploadedTo) {
//         findQuery.createdAt = {}
//         if (queryParams.uploadedFrom) {
//             findQuery.createdAt["$gte"] = moment(queryParams.uploadedFrom).toDate();
//         }
//         if (queryParams.uploadedTo) {
//             findQuery.createdAt["$lt"] = moment(queryParams.uploadedTo).add(1, 'days').toDate();
//         }
//     }
//     if (queryParams.workflowId) {
//         findQuery.idpId = createMongooseId(queryParams.idpId);
//     }
//     if (queryParams.statusCode) {
//         findQuery.statusCode = queryParams.statusCode
//     }
//     const queryLogs = [{ $match: { ...findQuery, } }]
//     queryLogs.push({
//         $lookup: {
//             from: 'workflows',
//             localField: 'workflowId',
//             foreignField: '_id',
//             as: 'workflow',
//         }
//     })
//     queryLogs.push({
//         $lookup: {
//             from: 'documents',
//             localField: 'idpId',
//             foreignField: 'idpId',
//             as: 'document',
//         }
//     })
//     queryLogs.push({
//         $lookup: {
//             from: 'idps',
//             localField: 'idpId',
//             foreignField: '_id',
//             as: 'batch',
//         }
//     })
//     queryLogs.push({ $unwind: { path: '$workflow', preserveNullAndEmptyArrays: true } })
//     // queryLogs.push({ $unwind: { path: '$document', preserveNullAndEmptyArrays: true } })

//     queryLogs.push({
//         $project: {
//             endpoint: 1,
//             method: 1,
//             payload: 1,
//             error: 1,
//             requestTime: 1,
//             responseTime: 1,
//             statusCode: 1,
//             ipAddress: 1,
//             batch: 1,
//             externalId: 1,
//             externalCustomerId: 1,
//             "workflow._id": 1,
//             "workflow.workflow": 1,
//             "response": 1,
//             "document.aiStatus": 1,
//             "document.fileOriginalName": 1,
//             "document.ocrRequestTime": 1,
//             "document.ocrResponseTime": 1,
//             "document.pageArray.pageNo": 1,
//             "document.pageArray.pageImageLink": 1,
//             "document.pageArray.dimension": 1,
//             "document.pageArray.nonTabularContent.confidence_score": 1,
//             "document.pageArray.nonTabularContent.global_key": 1,
//             "document.pageArray.nonTabularContent.data_type": 1,
//             "document.pageArray.nonTabularContent.mandatory": 1,
//             "document.nonTabularContent.local_value.text": 1,
//             "document.pageArray.nonTabularContent.local_value.pts": 1,
//             "document.createdAt": 1,
//             "document.updatedAt": 1,
//             "document.confidenceScore": 1,
//             apiResolveTime: { $subtract: ['$responseTime', '$requestTime'] },
//             createdAt: 1
//         }
//     })
//     queryLogs.push({
//         $facet: {
//             logs: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
//             count: [
//                 {
//                     $group: {
//                         count: { $sum: 1 },
//                         _id: null,
//                     },
//                 },
//             ]
//         }
//     })
//     console.log("QUERY MARK ", JSON.stringify(queryLogs))
//     OCR_LOGS.aggregate(queryLogs, (err, result) => {
//         if (err) {
//             return hcb(err)
//         }
//         const { logs: data, count } = result[0];
//         data.forEach(log => {
//             if (log.batch && log.batch[0]) {
//                 const batch = log.batch[0]
//                 log.status = batch.ocrStatus === "PENDING" ? "OCR_PENDING" : "OCR_COMPLETE"
//             } else {
//                 log.status = "OCR_FAILED";
//             }
//         })
//         hcb(null, {
//             ...HTTP_SUCCESS_MESSAGES.DEFAULT,
//             data,
//             totalCount: count[0] && count[0].count ? count[0].count : 0
//         })
//     })
// }
module.exports = {
    ocrLogsFetch,
    ocrLogsFetchMark
};
