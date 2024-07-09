const config = require('config');
const { auto, eachLimit } = require('async');
const moment = require("moment-timezone");
const VENDOR_MAPPING_INDEXER = require('../Models/vendorAI.model')
const { addressIdsService } = require('../Services');
const VENDOR_MAPPING = require('../Models/vendor-mapping-model')
const {
    documentService
} = require('../Services');
const { createMongooseId } = require('../Utils/universal-functions.util');
const PAGE = require('../Models/page.model');
const { updatePages } = require("../Utils/page.util");
const KEY_MAPPING = require('../Models/keyMapping.model')

const AI_STATUS = config.get('AI_STATUS');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const STATUS_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const vendorUniqueKey = "addressId"

/**
 * Map old vendor to a new/updated vendor
 * e,g address change of vendor
 */
const mappingVendor = (data, callback) => {
    const criteria = { ...data };
    delete criteria.documentId
    delete data.aiUniqueId
    auto({
        checkVendor: (cb) => {
            VENDOR_MAPPING.findOne(criteria, cb)
        },
        changeVendor: ['checkVendor', ({ checkVendor }, cb) => {
            if (checkVendor) {
                VENDOR_MAPPING.findOneAndUpdate(criteria, data, cb)
            } else {
                new VENDOR_MAPPING(data).save(cb)
            }
        }],
    }, callback)
}

const documentUpdate = ({ criteria, dataToSet, newPageArray }, callback) => {
    const pageArray = dataToSet.pageArray
    auto({
        docUpdate: (cb) => {
            const setData = dataToSet
            if (newPageArray && newPageArray[0]) {
                setData.pageArray = []
            }
            documentService.update(criteria, { $set: setData }, null, cb)
        },
        updateDocPages: (cb) => {
            console.log("DOC::::::::::::::::::::::::::::::::::::: processDocumentPdfGenerator")
            if (!(newPageArray && newPageArray[0])) {
                return cb()
            }
            updatePages({ documentId: criteria._id, pageArray, updateKeys: ['nonTabularContent'] }, cb)
        }
    }, callback)
}
/**
 * updateDocuments supplier
 * @param {*} data
 * @param {*} documents
 * @param {*} callback
 */
const updateDocuments = (data, documents, callback) => {
    const { vendorIdUpdated, supplierAddressUpdated, supplierNameUpdated, columnTypeUpdated } = data;

    eachLimit(documents, 10, (document, ecb) => {
        if (document.newPageArray && document.newPageArray[0]) {
            document.pageArray = document.newPageArray
        }
        if (document && document.pageArray && document.pageArray.length) {
            console.log("nontablur content FOUND ", document._id)
            document.pageArray.forEach(({ nonTabularContent = [] }) => {
                nonTabularContent.forEach((key) => {
                    if (key.global_key === "Vendor ID") {
                        // key.vendorId = r.local_value.text
                        key.local_value.text = vendorIdUpdated
                    }
                    if (key.global_key === "Vendor Address") {
                        // key.supplierAddress = r.local_value.text
                        key.local_value.text = supplierAddressUpdated
                    }
                    if (key.global_key === "Vendor Name") {
                        // key.supplierName = r.local_value.text
                        key.local_value.text = supplierNameUpdated
                    }
                })
            })
            console.log("vendor updated sucessfully ", document._id)
            const dataToSet = { pageArray: document.pageArray, flagVendorExists: true }
            if (columnTypeUpdated) {
                dataToSet.header_table = columnTypeUpdated
            }
            // documentService.update({ _id: document._id }, { $set: dataToSet }, null, ecb)
            documentUpdate({ criteria: { _id: document._id }, dataToSet, newPageArray: document.newPageArray }, ecb)
        } else {
            console.log("nontablur content not found ", document)
            ecb()
        }
    }, (err) => {
        console.log("DOCUMENT UPDATEDDDD", err);
        callback(null, true)
    })
}
/**
 * Update suplier for review pending documents
 * @param {*} data
 * @param {*} callback
 */

const updateDocumentsSupplier = (data, docIds, callback) => {
    const { addressId, docType } = data;
    const matchDocuments = { aiStatus: AI_STATUS.OCR_DONE, qcStatus: { $in: ["PENDING", "ASSIGNED_SUPERVISOR"] }, addressId, docType }
    const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0)) // .toISOString()
    const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999))// .toISOString()
    matchDocuments.createdAt = {
        $gte: startOfDay,
        $lt: endOfDay
    }
    auto({
        documents: (cb) => {
            const matchDocument = {
                ...matchDocuments,
            }
            documentService.aggregation([
                { $match: matchDocument },
                {
                    $lookup: {
                        from: "pages",
                        localField: "_id",
                        foreignField: "documentId",
                        as: "newPageArray"
                    }
                }, {
                    $project: { pageArray: 1, newPageArray: 1 }
                }], cb)
        },
        documentsUpdated: (cb) => {
            const matchDocument = {
                _id: { $in: docIds },
            }
            documentService.aggregation([
                { $match: matchDocument },
                {
                    $lookup: {
                        from: "pages",
                        localField: "_id",
                        foreignField: "documentId",
                        as: "newPageArray"
                    }
                }, {
                    $project: { pageArray: 1, newPageArray: 1 }
                }], cb)
        },
        updateDocuments: ['documents', ({ documents = [], documentsUpdated = [] }, cb) => {
            auto({
                reviewPending: (acb) => {
                    updateDocuments(data, documents, acb)
                },
                reviewApplied: (acb) => {
                    updateDocuments(data, documentsUpdated, acb)
                }
            }, cb)
        }],
        updateMapping: (cb) => {
            mappingVendor(data, cb)
        }
    }, (err, { updateMapping }) => {
        console.log("VENDOR MAPPING UPDATED :", updateMapping)
        console.log("VENDOR MAPPING UPDATED ERROR:", err)
        console.log("callback", callback)
        callback(null, true)
    })
}
const checkMapping = (data, callback) => {
    auto({
        vendors: (cb) => {
            const queryObj = { vendorId: data.vendorId, vendorIdUpdated: data.vendorIdUpdated, customerId: data.customerId, docType: data.docType }
            const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()
            const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString()
            queryObj.createdAt = {
                $gte: startOfDay,
                $lt: endOfDay
            }
            // queryObj.data
            queryObj.addressId = data[vendorUniqueKey]
            if (!data[vendorUniqueKey]) {
                console.log("NO adddress id found");
                return cb(null, [])
            }
            console.log("queryObj queryObj queryObj: ", queryObj)
            Object.keys(queryObj).forEach(k => {
                queryObj[k] = queryObj[k] || ''
            });
            VENDOR_MAPPING_INDEXER.find(queryObj, cb)
        },
        updateMapping: ['vendors', ({ vendors }, cb) => {
            console.log("MMMMMMMMMMMMMMM check vendor", data)
            if (vendors.length >= 3 && (data.vendorId === "NO_VENDOR" || data.vendorIdUpdated === "NO_VENDOR")) {
                const appliedRuleDocIds = vendors.map(v => createMongooseId(v.documentId))
                console.log("NO_VENDOR MAPPING VENDORS CHSNGED IS times :", vendors.length);
                updateDocumentsSupplier(data, appliedRuleDocIds, cb)
            } else if (vendors.length >= 5 && data.vendorId !== "NO_VENDOR" && data.vendorIdUpdated !== "NO_VENDOR") {
                console.log("VENDORS CHSNGED IS times :", vendors.length);
                const appliedRuleDocIds = vendors.map(v => createMongooseId(v.documentId))
                updateDocumentsSupplier(data, appliedRuleDocIds, cb)
            } else {
                cb(null, false)
            }
        }]
    }, (err, { updateMapping }) => {
        console.log("mapping checked: ", err)
        callback(err, updateMapping)
    })
}
const fetchVendorsAiIMC = (user, body, hcb) => {
    console.log("body:", body)
    const { matchQuery = {}, projection = {} } = body;
    const criteria = matchQuery;
    auto({
        list: (cb) => {
            VENDOR_MAPPING_INDEXER.find(criteria, projection, cb)
        }
    }, (err, { list }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: list })
    })
}

const vendorAiUpdate = (userId, data, hcb) => {
    console.log("vendorAiUpdate call")
    const { _id, uploadedDocType, columnType, columnTypeUpdated } = data;

    const dataToSet = {}
    auto({
        document: (cb) => {
            documentService.findOne({ _id }, null, null, null, cb)
        },
        Pages: (cb) => {
            PAGE.find({ documentId: _id }).lean().exec(cb)
        },
        updatedVendor: ['document', 'Pages', ({ document, Pages }, cb) => {
            if (Pages && Pages[0]) {
                document.pageArray = Pages
            }
            const { pageArray, externalCustomerId, aiUniqueId, fileOriginalName, pageRange, addressId } = document;
            pageArray.forEach(({ nonTabularContent }) => {
                nonTabularContent.forEach((r) => {
                    if (r.global_key === "Vendor ID" && r.local_value.edited_value !== null && (r.local_value.edited_value || (r.local_value.edited_value !== r.local_value.text))) {
                        dataToSet.vendorId = r.local_value.text
                        dataToSet.vendorIdUpdated = r.local_value.edited_value
                    }
                    if (r.global_key === "Vendor Address" && r.local_value.edited_value !== null && (r.local_value.edited_value || (r.local_value.edited_value !== r.local_value.text))) {
                        dataToSet.supplierAddress = r.local_value.text
                        dataToSet.supplierAddressUpdated = r.local_value.edited_value
                    }
                    if (r.global_key === "Vendor Name" && r.local_value.edited_value !== null && (r.local_value.edited_value || (r.local_value.edited_value !== r.local_value.text))) {
                        dataToSet.supplierName = r.local_value.text
                        dataToSet.supplierNameUpdated = r.local_value.edited_value
                    }
                })
            })
            if (!Object.keys(dataToSet).length) {
                return hcb()
            }
            dataToSet.documentId = _id
            dataToSet.uploadedDocType = uploadedDocType
            dataToSet.customerId = externalCustomerId
            dataToSet.aiUniqueId = aiUniqueId
            dataToSet.fileOriginalName = fileOriginalName
            dataToSet.pageRange = pageRange
            dataToSet.userId = userId
            dataToSet.addressId = addressId
            dataToSet.columnType = columnType
            dataToSet.columnTypeUpdated = columnTypeUpdated
            dataToSet.docType = data.docType
            console.log("DEBUG DATA TO SET", dataToSet)
            new VENDOR_MAPPING_INDEXER(dataToSet).save(cb)
        }],
    }, (err, { updatedVendor }) => {
        if (err) {
            console.log("VENDOR AI UPDATE ERROR", err)
        }
        checkMapping(dataToSet, (err, flag) => {
            console.log("MAPPING: ", flag)
            if (flag) {
                VENDOR_MAPPING_INDEXER.updateOne({ _id: updatedVendor._id }, { $set: { mappingChanged: true } })
            }
        })
        return hcb(null, updatedVendor)
    })
}
const fetchVendorsMappingIndexerHistory = (user, { limit = 10, offset = 0, mappingChanged, sortBy = 'createdAt', orderBy = 'DESC', fromDate, toDate }, hcb) => {
    const criteria = {};
    const sortObj = {
        [sortBy]: orderBy === 'DESC' ? -1 : 1
    };
    if (toDate || fromDate) {
        criteria.createdAt = {}
        if (fromDate) {
            criteria.createdAt.$gte = new Date(fromDate)
        }
        if (toDate) {
            criteria.createdAt.$lte = new Date(toDate)
        }
    }
    if (typeof mappingChanged === 'boolean') {
        criteria.mappingChanged = mappingChanged
    }
    auto({
        count: (cb) => {
            VENDOR_MAPPING_INDEXER.countDocuments(criteria, cb)
        },
        list: (cb) => {
            const query = VENDOR_MAPPING_INDEXER.find(criteria, cb)
            query.sort(sortObj)
            query.skip(offset)
            query.limit(limit)
            query.lean().exec(cb)
        }
    }, (err, { list, count }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: list, countMapping: count })
    })
}
/**  addressId store for AI */

const addressIdGenerator = (user, { addressRaw, address, addressID, date }, hcb) => {
    const isoDate = new Date(date).toISOString()
    let isAddressIdPresent = false
    auto({
        count: (cb) => {
            const criteria = {
                address,
                date: { $eq: isoDate }
            };
            addressIdsService.count(criteria, (err, result) => {
                if (err) {
                    console.error("addressIdsService error", addressIdsService)
                    cb(err)
                }
                console.log("count+++++++>", result)
                if (result > 0) {
                    isAddressIdPresent = true
                }
                cb()
            })
        },
        updateDB: ["count", (res, cb) => {
            if (isAddressIdPresent) {
                console.error("for address", address, STATUS_ERROR_MESSAGES.ADDRESS_ID_ALREADY_PRESENT.message)
                return cb(STATUS_ERROR_MESSAGES.ADDRESS_ID_ALREADY_PRESENT)
            }
            addressIdsService.create({
                addressRaw,
                address,
                addressID,
                date: isoDate
            }, (err) => {
                if (err) {
                    cb(err)
                } else {
                    cb()
                }
            })
        }]
    }, (err) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}
const fetchAddressId = (user, { address, date }, hcb) => {
    const isoDate = new Date(date).toISOString()
    let addressIdDetails = {}
    auto({
        count: (cb) => {
            const criteria = {
                address,
                date: { $eq: isoDate }
            };
            addressIdsService.findOne(criteria, (err, result) => {
                if (err) {
                    console.error("addressIdsService error", addressIdsService)
                    cb(err)
                }
                addressIdDetails = result
                cb()
            })
        },
    }, (err) => {
        if (err) {
            return hcb(err)
        }
        let finalRes = {}
        if (addressIdDetails) {
            finalRes = {
                addressRaw: addressIdDetails.addressRaw,
                address: addressIdDetails.address,
                addressID: addressIdDetails.addressID,
                date: moment(addressIdDetails.date).format('YYYY-MM-DD'),
            }
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: finalRes })
    })
}
const fetchAllAddressIds = (user, hcb) => {
    let addressIdDetails = []
    auto({
        count: (cb) => {
            addressIdsService.findAll({}, {}, {}, (err, result) => {
                if (err) {
                    console.error("addressIdsService error", addressIdsService)
                    cb(err)
                }
                addressIdDetails = result
                cb()
            })
        },
    }, (err) => {
        if (err) {
            return hcb(err)
        }
        const finalRes = []
        if (addressIdDetails) {
            for (const each of addressIdDetails) {
                finalRes.push({
                    addressRaw: each.addressRaw,
                    address: each.address,
                    addressID: each.addressID,
                    date: moment(each.date).format('YYYY-MM-DD'),
                })
            }
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: finalRes })
    })
}

/**  key mapping store for AI */
const keyMappingGenerator = (user, payload, hcb) => {
    auto({
        updateMappin: (cb) => {
            const criteria = {
                docType: payload.docType,
                columnGlobal: payload.columnGlobal
            };
            const dataToSet = {
                docType: payload.docType,
                columnGlobal: payload.columnGlobal,
                localList: payload.localList
            }
            if (payload.companyId) {
                criteria.companyId = payload.companyId
                dataToSet.companyId = payload.companyId
            }
            if (payload.tenantId) {
                criteria.tenantId = payload.tenantId
                dataToSet.tenantId = payload.tenantId
            }
            if (payload.addressId) {
                criteria.addressId = payload.addressId
                dataToSet.addressId = payload.addressId
            }
            KEY_MAPPING.findOneAndUpdate(criteria, { $set: dataToSet }, { upsert: true }, cb)
        }
    }, (err) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}
const fetchKeyMapping = (user, { companyId, docType, columnGlobal, tenantId, addressId }, hcb) => {
    auto({
        keyMapping: (cb) => {
            const criteria = {
            };
            if (companyId) {
                criteria.companyId = companyId
            }
            if (docType) {
                criteria.docType = docType
            }
            if (columnGlobal) {
                criteria.columnGlobal = columnGlobal
            }
            if (tenantId) {
                criteria.tenantId = tenantId
            }
            if (addressId) {
                criteria.addressId = addressId
            }
            KEY_MAPPING.findOne(criteria, cb)
        },
    }, (err, { keyMapping }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: keyMapping })
    })
}
const fetchAllKeyMapping = (user, { companyId, docType, columnGlobal, tenantId, addressId }, hcb) => {
    auto({
        keyMappings: (cb) => {
            const criteria = {
            };
            if (companyId) {
                criteria.companyId = companyId
            }
            if (docType) {
                criteria.docType = docType
            }
            if (columnGlobal) {
                criteria.columnGlobal = columnGlobal
            }
            if (tenantId) {
                criteria.tenantId = tenantId
            }
            if (addressId) {
                criteria.addressId = addressId
            }
            KEY_MAPPING.find(criteria, cb)
        },
    }, (err, { keyMappings }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: keyMappings })
    })
}
/**  key mapping store for AI */
const removekeyMapping = (user, payload, hcb) => {
    auto({
        updateMappin: (cb) => {
            const criteria = {
            };
            if (payload.recordIds) {
                criteria._id = { $in: payload.recordIds }
            }
            if (payload.tenantId) {
                criteria.tenantId = payload.tenantId
            }
            KEY_MAPPING.deleteMany(criteria, cb)
        }
    }, (err) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}
module.exports = {
    fetchVendorsAiIMC,
    vendorAiUpdate,
    fetchVendorsMappingIndexerHistory,
    addressIdGenerator,
    fetchAddressId,
    fetchAllAddressIds,
    keyMappingGenerator,
    fetchKeyMapping,
    fetchAllKeyMapping,
    removekeyMapping
}
