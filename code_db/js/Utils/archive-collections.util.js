const { auto, eachSeries } = require('async')
const { documentService, idpService, tenantService } = require('../Services');
const ARCHIVED_DETAILS = require("../Models/archive.details.model")

const saveArchivedDetails = (data, callback) => {
    auto({
        archive: (cb) => {
            // console.log('inside archive')
            ARCHIVED_DETAILS.findOne({ tenantId: data.tenantId, collectionType: data.collectionType }, cb)
        },
        createarchive: ['archive', ({ archive }, cb) => {
            // console.log('inside createarchive', data)
            if (archive) {
                return cb()
            }
            ARCHIVED_DETAILS.create(data, (e, r) => {
                console.log("SAVE ARCHIVE:", e, r)
                cb()
            })
        }],
        updateArchive: ['createarchive', ({ archive }, cb) => {
            // console.log('inside updateArchive')
            if (!archive) {
                return cb()
            }
            ARCHIVED_DETAILS.updateOne(
                { _id: archive._id },
                {
                    $set: { ...data, totalArchived: (data.totalArchived + archive.totalArchived) }
                },
                (e, r) => {
                    console.log("UPDATE ARCHIVE:", e, r)
                    cb()
                }
            )
        }],
    }, callback)
}

/**
 * Archive documents
 */
const archiveDocuments = ({ tenantId }, callback) => {
    const dateBefore = new Date().getTime() - 1000 * 60 * 60 * 24 * 30 * 4 // 3 months
    const criteria = {
        tenantId,
        documentDeleted: true,
        documentDownloadedAt: { $lte: new Date(dateBefore) }
    }
    let stages = []
    auto({
        docsToArchiveCount: (cb) => {
            documentService.count({ ...criteria }, (e, r) => {
                cb(e, r)
            })
        },
        createArchievedCollection: ['docsToArchiveCount', ({ docsToArchiveCount }, cb) => {
            if (!docsToArchiveCount) {
                return cb(null, false)
            }
            stages = [
                { $match: criteria },
                {
                    $merge: {
                        into: "archivedDocuments",
                        on: "_id",
                        whenMatched: "replace",
                        whenNotMatched: "insert"
                    }
                }
            ]
            // runQuery({ rawData: false, collection: "documents", method: "aggregateRaw", query: stages }, (e, r) => {
            documentService.aggregation(stages, (e, r) => {
                console.log("match doc stages:", JSON.stringify(stages));
                console.log("E D:", e, r)
                if (e) {
                    return cb(null, false)
                }
                return cb(null, true);
            })
        }],
        saveArchevedDataDetails: ['createArchievedCollection', 'docsToArchiveCount', ({ docsToArchiveCount }, cb) => {
            // console.log("saveArchevedDataDetrails", docsToArchiveCount)
            // return cb()
            if (!docsToArchiveCount) {
                return cb()
            }
            const data = { tenantId, totalArchived: docsToArchiveCount, lastCriteriaUsed: JSON.stringify(stages), collectionType: "document" }
            saveArchivedDetails(data, cb)
        }],
        deleteDataDocuments: ['saveArchevedDataDetails', ({ docsToArchiveCount }, cb) => {
            // console.log("deleteDataDocuments", docsToArchiveCount)
            if (!docsToArchiveCount) {
                return cb(null, false)
            }
            documentService.deleteMany(criteria, cb)
        }]
    }, (e, r) => {
        console.log("DOCS Archive successs", !e, r);
        if (e) {
            console.log("archiveDocuments ERROR:: ", e)
        }
        callback()
    })
}
/**
 * Archive batches
 */
const archiveBatches = ({ tenantId }, callback) => {
    const dateBefore = new Date().getTime() - 1000 * 60 * 60 * 24 * 30 * 3
    const criteria = {
        tenantId,
        qcStatus: "COMPLETED",
        createdAt: { $lte: new Date(dateBefore) }
    }
    let selectedBatches = null
    const stages = [
        {
            $match: criteria
        },
        {
            $lookup: {
                from: "documents",
                localField: "_id",
                foreignField: "idpId",
                as: "docs",
            }
        },
        { $match: { "docs.0": { $exists: false } } },
    ]
    auto({
        batchesToArchiveCount: (cb) => {
            idpService.aggregation([...stages, {
                $group: {
                    _id: null, batchIds: { $addToSet: "$_id" }, count: { $sum: 1 }
                }
            }], (e, b) => {
                // console.log("batchesToArchiveCount:::", e)
                if (e) {
                    return cb(null, 0);
                }
                const { batchIds = [], count = 0 } = b[0] || {}
                selectedBatches = batchIds
                return cb(null, count)
            })
        },
        createArchievedCollection: ['batchesToArchiveCount', ({ batchesToArchiveCount }, cb) => {
            // console.log("createArchievedCollectionBatch", batchesToArchiveCount)
            if (!batchesToArchiveCount) {
                return cb(null, false)
            }
            stages.push(
                {
                    $merge: {
                        into: "archivedBatches",
                        on: "_id",
                        whenMatched: "replace",
                        whenNotMatched: "insert"
                    }
                }
            )
            // runQuery({ rawData: true, collection: "idp", method: "aggregate", query: stages }, (e, r) => {
            idpService.aggregation(stages, (e, r) => {
                console.log("match batch stages:", JSON.stringify(stages))
                console.log("E B:", e, r)
                if (e) {
                    return cb(null, false)
                }
                return cb(null, true);
            })
        }],
        saveArchevedDataDetails: ['createArchievedCollection', 'batchesToArchiveCount', ({ batchesToArchiveCount }, cb) => {
            // console.log("saveArchevedDataDetrailsBatch", batchesToArchiveCount)
            if (!batchesToArchiveCount) {
                return cb()
            }
            const data = { tenantId, totalArchived: batchesToArchiveCount, lastCriteriaUsed: JSON.stringify(stages), collectionType: "idp" }
            saveArchivedDetails(data, cb)
        }],
        deleteDataBatches: ['createArchievedCollection', ({ batchesToArchiveCount }, cb) => {
            // console.log("deleteDataDocumentsBatch", selectedBatches && selectedBatches.length)
            if (!batchesToArchiveCount) {
                return cb(null, false)
            }
            idpService.deleteMany({ _id: { $in: selectedBatches } }, cb)
        }]
    }, (e, r) => {
        console.log("BATCh Archive successs", !e, r);
        if (e) {
            console.log("archiveBatches ERROR:: ", e)
        }
        callback()
    })
}
const startArchive = (data, callback) => {
    console.log(".........................startArchive....................", data)
    const startTime = new Date().getTime()
    auto({
        startDocsArchive: (cb) => {
            archiveDocuments(data, cb);
        },
        startBatchesArchive: ['startDocsArchive', (_, cb) => {
            archiveBatches(data, cb)
        }],
    }, (e) => {
        if (e) {
            console.log("ERROR startArchive", e)
        } else {
            // let startTime = new Date().getTime()
            console.log("DATA ARCHIVED SUCCESSFULLY IN:", new Date() - startTime)
        }
        callback()
    })
};

const startArchiveProcess = () => {
    auto({
        Tenants: (cb) => {
            tenantService.findAll({}, { _id: 1, name: 1 }, {}, cb)
        },
        startProcess: ['Tenants', ({ Tenants }, cb) => {
            eachSeries(Tenants, (Tenant, ecb) => {
                console.log("start archive for tenant: ", Tenant.name)
                startArchive({ tenantId: Tenant._id }, ecb)
            }, cb)
        }]
    })
}
module.exports = {
    startArchive: startArchiveProcess
};
