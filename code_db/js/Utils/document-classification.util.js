const config = require('config');
const { auto, eachSeries } = require("async")
const { documentService } = require("../Services");
const { processKeyValueExtract, generatePdf, rotateImages } = require('./ai-endpoints.util')
const { verifyDocumentCount } = require('./ocr.util')
const { GLOBAL_MAPPING_MOCK, } = require("../Mock/global-mapping.mock")
const { totalActiveServers } = require("./load-balancer")
const { EMIT_EVENT } = require('./data-emitter.util');
const CUSTOMER = require('../Models/customer.model')
const { createMongooseId, createNewMongooseId } = require('./universal-functions.util');
const { deleteDocumentFileFromS3 } = require('./S3')
const { DEFAULT_NON_TABLAR_CONTENT } = require("../Mock/non-tabular-content")
const { sendEmail } = require('./imc-endpoints.util');
const IDP_BACKUP = require('../Models/idp-documentlist-backup.model');
const PAGE = require('../Models/page.model');
const { updatePages } = require("./page.util")
const { DEFAULT_CONTENT } = require("../Mock/non-tabular-content")
const { checkReviewPercent } = require("../Controllers/latest-teams.controller");

const OCR_MAX_TIME_LIMIT = config.get('OCR_MAX_TIME_LIMIT')
const INDEXER = config.get("ROLES.INDEXER")
const APP_EVENTS = config.get('APP_EVENTS');
const INVOICE = GLOBAL_MAPPING_MOCK.filter(d => d.seedId === "seedId_10")[0];
const GLOBAL_DOC_TYPE = INVOICE.documentType

const isSupportingDocument = (pages) => {
    let supporting = true;
    pages.forEach(p => {
        if (p.page_type !== '#NEW_FORMAT#') {
            supporting = false
        }
    });
    return supporting
}
// ....................................................classification starts............................................
const _newDocument = (data, newDocNumber, callback) => {
    const objectTosave = { ...data }
    delete objectTosave._id
    const checkPage = objectTosave.checkPage
    delete objectTosave.checkPage
    delete objectTosave.__v

    // delete objectTosave.createdAt
    delete objectTosave.updatedAt
    objectTosave.classification = "STARTED";
    objectTosave.docNumber = newDocNumber;
    objectTosave.pdfMerged = false
    objectTosave.keyExtracted = false
    objectTosave.ocrUrl = null
    objectTosave.keyExtractRequestTime = null
    objectTosave.keyExtractResponseTime = null
    // if (objectTosave.pageArray) {
    //     objectTosave.pageArray.forEach((p, index) => { p.pageNo = (index + 1) })
    // }
    let addDeaultContent = false
    if (objectTosave.docType === "#NEW_FORMAT#") {
        objectTosave.flagVendorExists = true // add default condition for vendor
        objectTosave.ocrClassification = "COMPLETED" // skip key extraction
        objectTosave.keyExtracted = false // skip key extraction // send for jpg rotation
    } else if (data.kvpDisabled) {
        console.log("keyExtracted disabled data.kvpDisabled", data.kvpDisabled)
        objectTosave.ocrClassification = "COMPLETED" // skip key extraction
        objectTosave.keyExtracted = false // skip key extraction // send for jpg rotation
        addDeaultContent = true
        // objectTosave.pageArray.forEach((p, i) => {
        //     if (i === 0) {
        //          if (data.docType === "Invoices Custom") {
        //             p.nonTabularContent = DEFAULT_NON_TABLAR_CONTENT.map(e => ({ ...e, fieldId: createNewMongooseId() }))
        //          }
        //     } else {
        //         p.nonTabularContent = []
        //     }
        // })
    }
    delete objectTosave.keyExtracted
    const pages = objectTosave.pageArray
    auto({
        incrementDocuments: (cb) => {
            return cb();
            // documentService.updateAll({ fileName: objectTosave.fileName, docNumber: { $gte: objectTosave.docNumber } }, { $inc: { docNumber: 1 } }, null, cb)
        },
        addDefaultData: (cb) => {
            if (!addDeaultContent) {
                return cb()
            }
            console.log("addDeaultContent: ", addDeaultContent)
            DEFAULT_CONTENT({ documentType: objectTosave.docType, tenantId: objectTosave.tenantId }, (e, defaultContent) => {
                const p = objectTosave.pageArray[0]
                p.nonTabularContent = defaultContent.nonTabularContent.map(e => ({ ...e, fieldId: createNewMongooseId() }))
                p.tabularContent = defaultContent.tabularContent
                cb()
            })
        },
        doc: ['incrementDocuments', 'addDefaultData', (_, cb) => {
            // console.log("_newDocument: ", JSON.stringify(objectTosave))
            if (checkPage) {
                objectTosave.pageArray = [] // skip pageArray update on doc shema will update pageschema
            }
            objectTosave.status = "CLASSIFICATION_CHANGING" // clasification modified by indexer or supervisor for doc starts
            documentService.create(objectTosave, cb)
        }],
        updateDocPages: ["doc", ({ doc }, cb) => {
            console.log("DOC::::::::::::::::::::::::::::::::::::: _newDocument")
            if (!checkPage) {
                return cb()
            }
            console.log("updatePages called")
            const updateKeys = ["pageNo", "nonTabularContent", "tabularContent", "ocrStrategyChanged",
                "page_type", "sumRotateByDegree", "rotateByDegree", "ocrStrategy"]
            updatePages({ documentId: doc._id, idpId: data.idpId, pageArray: pages, updateKeys }, cb)
        }],
        changeDocStatus: ["updateDocPages", ({ doc }, cb) => {
            documentService.update({ _id: doc._id }, { $set: { status: "CLASSIFICATION_CHANGED" } }, null, cb)//  clasification modified by indexer or supervisor for doc end sent to next step
        }],
        updateBatch: ['changeDocStatus', (_, cb) => {
            if (objectTosave.ocrClassification === "PENDING") {
                process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED';
                process.env.KEY_VALUE_EXTRACT_OCR_LAST_ENABLED_AT = new Date()
                EMIT_EVENT("SUPER_ADMIN_REFRESH", { opType: "REFRESH", type: "SUPER_ADMIN_REFRESH" });
            }
            return cb();
        }],
    }, (err, { doc }) => {
        if (err) {
            console.log("ERR on 14", err)
            console.log("ERR on 15", data)
            return callback(err)
        }
        callback(null, doc)
    })
}

const classify = ({ pages, docNumber, fileName, idpId }, callback) => {
    const validPage = { pagesData: {} };
    pages.forEach((e, i) => {
        validPage[e.pageId] = e.page_type
        e.pageNo = i + 1
        validPage.pagesData[e.pageId] = e
    });
    auto({
        checkPage: (cb) => {
            PAGE.findOne({ idpId }, cb)
        },
        documents: ["checkPage", ({ checkPage }, cb) => {
            if (checkPage) {
                return cb();
            }
            const pageIds = pages.map(p => createMongooseId(p.pageId))
            documentService.findAll({ idpId, "pageArray.pageId": { $in: pageIds } }, null, { lean: true, sort: { docNumber: 1 } }, cb)
        }],
        file: (cb) => {
            documentService.findOne({ idpId, fileName }, null, null, null, cb)
        },
        checkPages: ['documents', 'file', ({ documents, file, checkPage }, cb) => {
            if (checkPage) {
                return cb()
            }
            let docTotalPages = 0
            const pageArraySplitDoc = []
            let rotated = false
            let ocrStrategyChanged = false
            const files = {}
            let kvpDisabled = false
            let docType = "#NEW_FORMAT#"
            // console.log("checkPages  checkPagescheckPagescheckPagescheckPages.....................: ", JSON.stringify(documents))
            documents.forEach(document => {
                document.pageArray.forEach(p => {
                    if (validPage[p.pageId]) {
                        p.page_type = validPage[p.pageId]
                        if (p.disallow_kvp_flag) {
                            kvpDisabled = true
                        }
                        if (p.page_type === "#NEW_FORMAT#") {
                            p.tabularContent = []
                            p.nonTabularContent = []
                        } else {
                            docType = p.page_type
                        }
                        p.rotateByDegree = (validPage.pagesData[p.pageId].rotateByDegree) || 0
                        p.sumRotateByDegree = (p.sumRotateByDegree || 0) + (p.rotateByDegree)
                        if (p.rotateByDegree > 0) {
                            rotated = true
                        }
                        // if (p.ai_page_type === "#NEW_FORMAT#" && p.page_type !== "#NEW_FORMAT#") {
                        //     rotated = true // to send in kvp ocr queue
                        // }
                        pageArraySplitDoc.push(p);
                        files[document.fileName] = { fileName: document.fileName, fileOriginalName: document.fileOriginalName }
                        console.log("validPage.pagesData[p.pageId]: ", validPage.pagesData[p.pageId])
                        console.log("before check ocrStrategy:", p.ocrStrategy)
                        if (validPage.pagesData[p.pageId] && validPage.pagesData[p.pageId].ocrStrategy && validPage.pagesData[p.pageId].ocrStrategy !== (p.ocrStrategy && p.ocrStrategy[0])) {
                            p.ocrStrategy = [validPage.pagesData[p.pageId].ocrStrategy].concat(p.ocrStrategy).filter(e => e)
                            p.ocrStrategyChanged = true
                            ocrStrategyChanged = true
                        }
                        console.log("aafter check ocrStrategy: ", p.ocrStrategy)
                    }
                })
            })
            const newDoc = {
                ...documents[0],
                pdfMerged: false,
                keyExtracted: false,
                kvpDisabled,
                idpId,
                checkPage
            }
            if (file) {
                newDoc.fileName = file.fileName;
                newDoc.fileOriginalName = file.fileOriginalName
            }
            if (rotated || ocrStrategyChanged) {
                newDoc.ocrClassification = "PENDING"
            } else {
                newDoc.ocrClassification = "NOT_REQUIRED"
            }
            pageArraySplitDoc.forEach((p) => {
                p.pageNo = validPage.pagesData[p.pageId].pageNo // retain new page no
                docTotalPages++
            })
            newDoc.docTotalPages = docTotalPages
            newDoc.pageArray = pageArraySplitDoc.sort((a, b) => a.pageNo - b.pageNo)
            // newDoc.newDocNumber = docNumber
            // console.log("classify: ", JSON.stringify(pageArraySplitDoc))
            // if (isSupportingDocument(pages)) {
            //     newDoc.docType = "#NEW_FORMAT#"
            //     // newDoc.classification = "COMPLETED"
            //     newDoc.flagVendorExists = true // add default condition for vendor
            // } else {
            //     // newDoc.classification = "STARTED"
            //     newDoc.docType = GLOBAL_DOC_TYPE
            // }
            if (Object.keys(files).length > 1) {
                newDoc.filesMerged = Object.values(files)
            }
            newDoc.docType = docType
            _newDocument(newDoc, docNumber, cb)
        }],
        latestPages: ["checkPage", ({ checkPage }, cb) => {
            if (!checkPage) {
                return cb();
            }
            console.log("")
            const pageIds = pages.map(p => p.pageId)
            PAGE.find({ idpId, pageId: { $in: pageIds } })
                .populate({
                    path: "documentId",
                    select: "fileName fileOriginalName",
                })
                .lean()
                .exec(cb);
        }],
        checkPagesLatest: ['latestPages', 'file', ({ latestPages, file, checkPage }, cb) => {
            if (!checkPage) {
                return cb()
            }
            let docTotalPages = 0
            const pageArraySplitDoc = []
            let rotated = false
            let ocrStrategyChanged = false
            const files = {}
            let kvpDisabled = false
            let docType = "#NEW_FORMAT#"
            // console.log("checkPagesLatest  checkPagesLatestcheckPagesLatestcheckPagesLatest.....................: ")
            latestPages.forEach(p => {
                if (validPage[p.pageId]) {
                    p.page_type = validPage[p.pageId]
                    if (p.disallow_kvp_flag) {
                        kvpDisabled = true
                    }
                    if (p.page_type === "#NEW_FORMAT#") {
                        p.tabularContent = []
                        p.nonTabularContent = []
                    } else {
                        docType = p.page_type
                    }
                    p.rotateByDegree = (validPage.pagesData[p.pageId].rotateByDegree) || 0
                    p.sumRotateByDegree = (p.sumRotateByDegree || 0) + (p.rotateByDegree)
                    if (p.rotateByDegree > 0) {
                        rotated = true
                    }
                    // if (p.ai_page_type === "#NEW_FORMAT#" && p.page_type !== "#NEW_FORMAT#") {
                    //     rotated = true // to send in kvp ocr queue
                    // }
                    pageArraySplitDoc.push(p);
                    // console.log("DEBUG PAGE S DOCUMENT:", p)
                    const document = p.documentId
                    delete p.documentId
                    p.documentId = document._id
                    files[document.fileName] = { fileName: document.fileName, fileOriginalName: document.fileOriginalName }
                    // console.log("validPage.pagesData[p.pageId]: ", validPage.pagesData[p.pageId])
                    // console.log("before check ocrStrategy:", p.ocrStrategy)
                    if (validPage.pagesData[p.pageId] && validPage.pagesData[p.pageId].ocrStrategy && validPage.pagesData[p.pageId].ocrStrategy !== (p.ocrStrategy && p.ocrStrategy[0])) {
                        p.ocrStrategy = [validPage.pagesData[p.pageId].ocrStrategy].concat(p.ocrStrategy).filter(e => e)
                        p.ocrStrategyChanged = true
                        ocrStrategyChanged = true
                    }
                    // console.log("aafter check ocrStrategy: ", p.ocrStrategy)
                }
            })
            const newDoc = {
                ...file,
                pdfMerged: false,
                keyExtracted: false,
                kvpDisabled,
                idpId,
                checkPage
            }
            if (file) {
                newDoc.fileName = file.fileName;
                newDoc.fileOriginalName = file.fileOriginalName
            }
            if (rotated || ocrStrategyChanged) {
                newDoc.ocrClassification = "PENDING"
            } else {
                newDoc.ocrClassification = "NOT_REQUIRED"
            }
            pageArraySplitDoc.forEach((p) => {
                p.pageNo = validPage.pagesData[p.pageId].pageNo // retain new page no
                docTotalPages++
            })
            newDoc.docTotalPages = docTotalPages
            newDoc.pageArray = pageArraySplitDoc // .sort((a, b) => a.pageNo - b.pageNo)
            // newDoc.newDocNumber = docNumber
            // console.log("classify: ", JSON.stringify(pageArraySplitDoc))
            // if (isSupportingDocument(pages)) {
            //     newDoc.docType = "#NEW_FORMAT#"
            //     // newDoc.classification = "COMPLETED"
            //     newDoc.flagVendorExists = true // add default condition for vendor
            // } else {
            //     // newDoc.classification = "STARTED"
            //     newDoc.docType = GLOBAL_DOC_TYPE
            // }
            if (Object.keys(files).length > 1) {
                newDoc.filesMerged = Object.values(files)
            }
            newDoc.docType = docType
            _newDocument(newDoc, docNumber, cb)
        }]
    }, callback)
}
// const rectifyExistingDocument = ({ documentId, pages }, callback) => {
//     const validPage = { pages: {} };
//     pages.forEach(e => {
//         validPage[e.pageId] = e.page_type;
//     });
//     auto({
//         document: (cb) => {
//             documentService.findOne({ _id: documentId }, null, { lean: true }, null, cb)
//         },
//         documents: (cb) => {
//             const pageIds = pages.map(p => createMongooseId(p.pageId))
//             documentService.findAll({ "pageArray.pageId": { $in: pageIds } }, null, { lean: true, sort: { docNumber: 1 } }, cb)
//         },
//         rectifyDocument: ['documents', ({ documents }, cb) => {
//             const pageArraySplitDoc = []
//             documents.forEach(document => {
//                 document.pageArray.forEach(p => {
//                     if (validPage[p.pageId]) {
//                         p.page_type = validPage[p.pageId]
//                         if (p.page_type === "#NEW_FORMAT#") {
//                             p.tabularContent = []
//                             p.nonTabularContent = []
//                         }
//                         pageArraySplitDoc.push(p);
//                     }
//                 })
//             })
//             pageArraySplitDoc.forEach((p, index) => { p.pageNo = (index + 1) })
//             console.log("rectifyExistingDocument: ", JSON.stringify(pageArraySplitDoc))
//             const dataToSet = { pageArray: pageArraySplitDoc, classification: "STARTED", pdfMerged: false, keyExtracted: false }
//             if (isSupportingDocument(pages)) {
//                 dataToSet.docType = "#NEW_FORMAT#"
//                 dataToSet.classification = "COMPLETED"
//                 dataToSet.flagVendorExists = true // add default condition for vendor
//             } else {
//                 dataToSet.classification = "STARTED"
//                 dataToSet.docType = GLOBAL_DOC_TYPE
//             }
//             documentService.update({ _id: documentId }, { $set: dataToSet }, null, cb)
//         }]
//     }, callback)
// }

const deleteExistingDocument = ({ documentId }, callback) => {
    auto({
        document: (cb) => {
            documentService.findOne({ _id: documentId }, null, { lean: true }, null, cb)
        },
        // incrementDocuments: ['document', ({ document }, cb) => {
        //     documentService.updateAll({ fileName: document.fileName, docNumber: { $gte: document.docNumber } }, { $inc: { docNumber: -1 } }, null, cb)
        // }],
        deleteDocument: ['document', ({ document }, cb) => {
            if (document && document._id) {
                documentService.deleteMany({ _id: document._id }, cb)
            } else {
                console.error("NO document found:::", documentId);
                cb()
            }
        }]
    }, callback)
}

/**
 * step 1
 * @param {*} clasification
 * @param {*} callback
 */
const splitDocuments = (clasification, callback) => {
    auto({
        clasification: (cb) => {
            const fileNewDocNumber = {} // to generate new Doc number with classification order
            const docsNew = clasification.filter(e => {
                const valid = e.changed && e.documentId === "NEW_DOCUMENT"
                if (valid) {
                    fileNewDocNumber[e.fileName] = fileNewDocNumber[e.fileName] + 1 || 1
                    e.docNumber = fileNewDocNumber[e.fileName] // assign newly generated doc number
                }
                return valid
            })
            console.log("CLASSIFICATION *CREATE NEW DOCS", JSON.stringify(docsNew))
            eachSeries(docsNew, classify, cb)
        }
    }, callback)
}

// /**
//  * step 2
//  * @param {*} clasification
//  * @param {*} callback
//  */

// const joinDocuments = (clasification, callback) => {
//     auto({
//         clasification: (cb) => {
//             const docsNew = clasification.filter(e => (e.documentId !== "NEW_DOCUMENT" && e.pages && e.pages.length))
//             console.log("CLASSIFICATION *JOIN DOCS", JSON.stringify(docsNew))
//             eachSeries(docsNew, rectifyExistingDocument, cb)
//         }
//     }, callback)
// }

/**
 * step 3
 * @param {*} clasification
 * @param {*} callback
 */
const removeDocuments = (clasification, callback) => {
    const docsNew = clasification.filter(e => e.changed && e.documentId !== "NEW_DOCUMENT" && !(e.pages && e.pages.length))
    auto({
        purgeMegedDucuments: (cb) => {
            // return cb();
            eachSeries(docsNew, (doc, ecb) => {
                documentService.findOne({ _id: doc.documentId }, { s3DocumentPdfLink: 1 }, null, null, (e, doc) => {
                    return ecb() // todo store links to be purged later
                    deleteDocumentFileFromS3(doc.s3DocumentPdfLink, (err) => {
                        console.log("file purged for merged document err", err)
                        ecb()
                    })
                })
            }, cb)
        },
        clasification: ['purgeMegedDucuments', (_, cb) => {
            console.log("CLASSIFICATION *REMOVE DOCS", JSON.stringify(docsNew))
            eachSeries(docsNew, deleteExistingDocument, cb)
        }]
    }, callback)
}

// ....................................................classification ends............................................
// ....................................................Key value extraction starts............................................

// oldClassification = [{
//   docId: "doc1",
//   pages: ["pageId1"],
//   docNumber: 1
// }, {
//   docId: "doc2",
//   pages: ["pageId2"],
//   docNumber: 2
// },
// {
//   docId: "doc3",
//   pages: ["pageId3"],
//   docNumber: 3
// }, {
//   docId: "doc4",
//   pages: ["pageId4"],
//   docNumber: 4
// },
// {
//   docId: "doc5",
//   pages: ["pageId5","pageId6"],
//   docNumber: 5
// }]
//         newClassification=[{
//       docId: "doc1",
//       pages: ["pageId1","pageId2"],
//       docNumber: 1
//     }, {
//       docId: "doc2",
//       pages: [],
//       docNumber: 2
//     },
//     {
//       docId: "doc3",
//       pages: [pageId3,pageId4],
//       docNumber: 2
//     }, {
//       docId: "doc4",
//       pages: [],
//       docNumber: 4
//     },
// {
//   docId: "doc5",
//   pages: ["pageId5"],
//   docNumber: 3
// },
// {
//   docId: "NEW_DOCUMENT",
//   pages: ["pageId6"],
//   docNumber: 4
// }
// ]
/*
*1) create new records for the incoming new classification
* 2) delete all previous records of the existing document
* 3) update the existing idp id with correct no. of pages now/docs
*
*
* */
/**
 * apply user defined classification
 * @param { idpId, fileName, newClassification:[{}] } param0
 * @param {*} callback
 */
const reClassifyDocumentsPages = ({ newClassification = [], idpId }, callback) => {
    console.log("newClassificationnewClassification: ", JSON.stringify(newClassification));
    if (newClassification && newClassification.length) {
        const missedDocIdToDelete = [];
        newClassification.forEach((documentToTraverse) => {
            documentToTraverse.idpId = idpId
            if (documentToTraverse.changed && documentToTraverse.pages && documentToTraverse.pages.length) {
                if (documentToTraverse.documentId === 'NEW_DOCUMENT') {
                    // all good
                } else {
                    // if anything else than new doc, then its a frontend error
                    missedDocIdToDelete.push(documentToTraverse.documentId)
                    documentToTraverse.documentId = 'NEW_DOCUMENT'
                }
            }
        })
        if (missedDocIdToDelete.length) {
            missedDocIdToDelete.forEach((missedEntry) => {
                const objToInsert = {
                    docNumber: newClassification[newClassification.length - 1].docNumber + 1,
                    documentId: missedEntry,
                    pages: [],
                }
                newClassification.push(objToInsert)
            })
            console.log('after frontend bug was fixed')
            console.log("after frontend bug was fixed revClassificationRevClassification: ", JSON.stringify(newClassification));
        }
    }
    auto({
        split: (cb) => {
            splitDocuments(newClassification, cb); // new doc with pages || existing doc with pages
        },
        // join: ['split', (_, cb) => {
        //     joinDocuments(newClassification, cb); // update pages for document by joining or removing pages
        // }],
        remove: ['split', (_, cb) => {
            removeDocuments(newClassification, cb); // remove documents with no/zero pages
        }],
        verifyDocumentCount: ['remove', (_, cb) => {
            verifyDocumentCount(idpId, false, cb)
        }],
    }, callback)
}
const processDocument = (doc, callback) => {
    const pageArray = doc.pageArray
    auto({
        keyValueExtract: (cb) => {
            const pagesInv = pageArray.filter(e => e.page_type !== "#NEW_FORMAT#")
            if (doc.docType === "#NEW_FORMAT#" || doc.keyExtracted || !(pagesInv && pagesInv.length) || doc.ocrClassification !== "NOT_REQUIRED") {
                return cb(null, { error: false, disableKeyExtract: true })
            }
            let rotationChanged = false;
            pagesInv.forEach(e => {
                if (e.rotateByDegree && e.rotateByDegree > 0) {
                    rotationChanged = true;
                }
            })
            /** temporary stop sending to AI */
            if (rotationChanged) {
                console.log("Rotated file in direct kvp")
                return cb(null, { error: false, disableKeyExtract: true })
            }
            const document = { ...doc, pageArray: pagesInv } // document with invoce pages
            documentService.update({ _id: doc._id }, { $set: { ocrClassification: "WITHOUT_OCR_IN_PROGRESS", keyExtractRequestTime: new Date() } }, null, (e) => {
                console.log("document updated keyValueExtract", e)
                if (e) {
                    return cb(e)
                }
                processKeyValueExtract(document).then((r) => {
                    console.log("respone sucess");
                    // keyValueExtract.wait
                    return cb(null, r)
                }).catch(e => {
                    console.log("respone ERROR", e);
                    return cb(null, { e, error: true })
                })
            })
        },
        getDefaultContent: (cb) => {
            DEFAULT_CONTENT({ documentType: doc.docType, tenantId: doc.tenantId }, cb)
        },
        updateDocument: ['keyValueExtract', 'getDefaultContent', ({ keyValueExtract, getDefaultContent }, cb) => {
            // update document here
            console.log("here")
            let dataToSet = {};
            let wait = false
            if (keyValueExtract && keyValueExtract.wait) {
                wait = true;
            }
            if (wait) {
                if (keyValueExtract.errorCode !== 54) {
                    return cb();
                }
                dataToSet.ocrClassification = "NOT_REQUIRED" // TODO temporary fix
                dataToSet.keyExtractRequestTime = null // TODO temporary fix
            }
            console.log("doc.classification", doc.classification)
            console.log("dataToSet.pdfMerged", dataToSet.pdfMerged)
            if (!wait && keyValueExtract.error) { // retry once
                //     dataToSet = {
                //         keyExtracted: false,
                //         pdfMerged: false,
                //         classification: "RETRY",
                //         ocrClassification: "NOT_REQUIRED"
                //     };
                // } else {
                dataToSet = {
                    ocrClassification: "FAILED", // classification failed
                    classification: "STARTED", // send for image rotator
                    keyValueExtract: false // send for image rotator
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
            console.log("dataToSet:", JSON.stringify(dataToSet))
            documentService.update({ _id: doc._id }, { $set: dataToSet }, { new: true }, cb)
        }],

    }, (e) => {
        if (e) {
            console.log("KEY EXTRACT ERROR: ", doc._id, e)
        }
        callback()
    })
}

const processDocumentPdfGenerator = (doc, callback) => {
    let updatedPages = null
    auto({
        Pages: (cb) => {
            PAGE.find({ documentId: doc._id }).sort({ pageNo: 1 }).lean().exec(cb)
        },
        getSingelPdfDocument: ['Pages', ({ Pages }, cb) => {
            if (Pages && Pages[0]) {
                doc.pageArray = Pages
            }
            if (!(doc.pageArray && doc.pageArray[0])) {
                console.log(".................. Not found pageArray on processDocumentPdfGenerator .............")
                return cb("pageArray not found")
            }
            generatePdf(doc).then((r) => cb(null, r)).catch(e => cb(null, { e, error: true }))
        }],
        getDefaultContent: (cb) => {
            DEFAULT_CONTENT({ documentType: doc.docType, tenantId: doc.tenantId }, cb)
        },
        updateDocument: ['getSingelPdfDocument', 'getDefaultContent', ({ Pages, getSingelPdfDocument, getDefaultContent }, cb) => {
            // update document here
            if (getSingelPdfDocument && getSingelPdfDocument.wait) {
                return cb();
            }
            let dataToSet = {};
            if (getSingelPdfDocument && getSingelPdfDocument.s3_pdf_path_output) {
                if (!getSingelPdfDocument.error) {
                    dataToSet.s3DocumentPdfLink = getSingelPdfDocument.s3_pdf_path_output
                    dataToSet.pdfMerged = true
                }
                dataToSet.classification = "COMPLETED"
            }

            //    //////////////////////////////////
            if (doc.ocrClassification === "COMPLETED" && dataToSet.pdfMerged) {
                // skip
            } else if (doc.classification === "STARTED" && (getSingelPdfDocument.error)) { // retry once
                dataToSet = {
                    pdfMerged: false,
                    classification: "RETRY"
                };
            } else if (doc.ocrClassification === "FAILED" && dataToSet.pdfMerged) { // passed for mannaul if pdf generated
                if (doc.docType !== "#NEW_FORMAT#" && dataToSet.pageArray) {
                    dataToSet.pageArray.forEach((p, i) => {
                        if (i === 0) {
                            p.nonTabularContent = getDefaultContent.nonTabularContent.map(e => ({ ...e, fieldId: createNewMongooseId() }))
                            p.tabularContent = getDefaultContent.tabularContent
                        } else {
                            p.nonTabularContent = []
                        }
                    })
                }
                dataToSet.classification = "COMPLETED"
            } else {
                dataToSet = { aiStatus: "OCR_FAILED", classification: "FAILED", failedStage: 'PDF_GENERATOR' } // classification failed
            }
            console.log("dataToSet pdf merge", dataToSet)
            if (Pages && Pages[0]) {
                updatedPages = dataToSet.pageArray
                dataToSet.pageArray = []
            }
            documentService.update({ _id: doc._id }, { $set: dataToSet }, { new: true }, cb)
        }],
        updateDocPages: ["updateDocument", ({ Pages }, cb) => {
            console.log("DOC::::::::::::::::::::::::::::::::::::: processDocumentPdfGenerator")
            if (!(Pages && Pages[0])) {
                return cb()
            }
            updatePages({ documentId: doc._id, idpId: doc.idpId, pageArray: updatedPages }, cb)
        }],
        deleteDocuments: ['updateDocument', ({ updateDocument }, cb) => {
            return cb()
            // if (updateDocument && updateDocument.aiStatus === "OCR_FAILED" && updateDocument.classification === "FAILED") {
            //     documentService.deleteMany({ idpId: updateDocument.idpId, fileName: updateDocument.fileName, _id: { $nin: [updateDocument._id] } }, cb)
            // } else {
            //     cb()
            // }
        }],
        verifyDocumentCount: ['deleteDocuments', (_, cb) => {
            verifyDocumentCount(doc.idpId, false, cb)
        }]
    }, (e) => {
        if (e) {
            console.log("PDF GENERATOR ERROR: ", doc._id, e)
        }
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: doc.tenantId, batchId: doc.idpId, eventType: "FILE_STATUS CHANGED", fileName: doc.fileName });
        callback()
    })
}
const startProcessing = (documents, callback) => {
    eachSeries(documents, (doc, cb) => {
        processDocument(doc, cb)
    }, (e, r) => {
        if (e) {
            console.log("ERROR IN KEY EXTRACTION", e)
        }
        callback(e, r)
    })
}
const startGeneratingFileForDocument = (documents, callback) => {
    eachSeries(documents, (doc, cb) => {
        processDocumentPdfGenerator(doc, cb)
    }, (e, r) => {
        if (e) {
            console.log("ERROR IN PDF generator", e)
        }
        callback(e, r)
    })
}

const updateDocument = ({ documentId, docType, tenantId, idpId }, dataToSet, callback) => {
    auto({
        getDefaultContent: (cb) => {
            if (dataToSet && dataToSet.pageArray && dataToSet.pageArray[0]) {
                DEFAULT_CONTENT({ documentType: docType, tenantId }, cb)
            }
            return cb;
        },
        updateDoc: (cb) => {
            const setData = { ...dataToSet };
            setData.pageArray = []
            documentService.update({ _id: documentId }, { $set: setData }, null, cb)
        },
        pagesUpdate: ['getDefaultContent', ({ getDefaultContent }, cb) => {
            if (getDefaultContent && dataToSet && dataToSet.pageArray && dataToSet.pageArray[0] && dataToSet.pageArray[0].nonTabularContent) {
                dataToSet.pageArray[0].nonTabularContent = getDefaultContent
            }
            if (!(dataToSet.pageArray && dataToSet.pageArray[0])) {
                return cb()
            }
            updatePages({ documentId, idpId, pageArray: dataToSet.pageArray }, cb)
        }],
    }, callback)
}
/** for no rotated images */
const startKeyValueExtract = (callback) => {
    auto({
        serverAvailable: (cb) => {
            // serverAvailable
            return cb();
            if (totalActiveServers() > 0) {
                return cb()
            }
            cb("no server availabe")
        },
        documents: ['serverAvailable', (_, cb) => {
            return cb()
            documentService.findAll({ classification: 'STARTED', keyExtracted: false, ocrClassification: 'NOT_REQUIRED', "pageArray.0": { $exists: true } }, null, { limit: 10 }, cb)
        }],
        retryDocuments: ['serverAvailable', (_, cb) => {
            return cb()
            documentService.findAll({ classification: 'RETRY', keyExtracted: false, ocrClassification: 'NOT_REQUIRED', "pageArray.0": { $exists: true } }, null, { limit: 10 }, cb)
        }],
        pendingDocuments: (cb) => {
            const criteria = { keyExtracted: false, ocrClassification: { $in: ['IN_PROGRESS', 'WITHOUT_OCR_IN_PROGRESS'] }, status: "CLASSIFICATION_CHANGED" }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.aggregation([
                { $match: criteria },
                {
                    $lookup: {
                        from: "pages",
                        localField: "_id",
                        foreignField: "documentId",
                        as: "newPageArray"
                    }
                },
                {
                    $project: {
                        classification: 1,
                        ocrClassification: 1,
                        keyExtractRequestTime: 1,
                        pageArray: 1,
                        newPageArray: 1,
                        ocrUrl: 1,
                        s3Url: 1,
                        fileOriginalName: 1,
                        idpId: 1,
                        docType: 1,
                        tenantId: 1
                    }
                }], cb)
        },
        checkPendingOcrReclassification: (cb) => {
            const criteria = { ocrClassification: "PENDING", status: "CLASSIFICATION_CHANGED" }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.count(criteria, cb)
        },
        checkFileTimeOut: ['pendingDocuments', 'checkPendingOcrReclassification', ({ pendingDocuments, checkPendingOcrReclassification }, cb) => {
            if (pendingDocuments && pendingDocuments.length) {
                const currentTime = new Date().getTime()
                const limitPerPage = 5
                eachSeries(pendingDocuments, (doc, escb) => {
                    const requestTime = new Date(doc.keyExtractRequestTime).getTime()
                    const diffrenceTime = currentTime - requestTime;
                    let dataToset = {}
                    let timeout = false
                    let expectedOcrTime = 0
                    if (doc && doc.newPageArray && doc.newPageArray[0]) {
                        doc.pageArray = doc.newPageArray
                    }
                    const pages = doc.pageArray.length
                    let ocrClassification = null
                    if (doc.ocrClassification === 'IN_PROGRESS') {
                        // expectedOcrTime = limitPerPage * 60 * 1000
                        expectedOcrTime = OCR_MAX_TIME_LIMIT * pages * 60 * 1000
                        ocrClassification = "PENDING"
                        if (diffrenceTime > expectedOcrTime) {
                            process.emit("lockIp", { ocrUrl: doc.ocrUrl, ipOcrLock: false, from: "Document classification keyExtract" })
                            timeout = true
                        }
                    } else if (doc.ocrClassification === 'WITHOUT_OCR_IN_PROGRESS') {
                        ocrClassification = "NOT_REQUIRED"
                        expectedOcrTime = OCR_MAX_TIME_LIMIT * pages * 60 * 1000
                        // expectedOcrTime = (limitPerPage * 60 * 1000)
                        if (diffrenceTime > expectedOcrTime) {
                            process.emit("lockIp", { ocrUrl: doc.ocrUrl, ipOcrLock: false, kvpNormal: true, from: "Document classification keyExtract" })
                            timeout = true
                        }
                    }
                    if (!timeout) {
                        return escb()
                    }
                    let keyExtractRetryCount = 1;
                    if (doc.classification === "STARTED") { // retry once
                        dataToset = {
                            keyExtracted: false,
                            pdfMerged: false,
                            classification: "RETRY",
                            ocrClassification
                        };
                        keyExtractRetryCount = 1
                    } else {
                        dataToset = {
                            ocrClassification: "FAILED", // classification failed
                            classification: "STARTED", // send for image rotator
                            keyValueExtract: false // send for image rotator
                        }
                        keyExtractRetryCount = 2
                        dataToset.pageArray = []
                        doc.pageArray.forEach((p, i) => { // move farward with 16 keys empty values
                            if (i === 0) {
                                p.nonTabularContent = [{}]// DEFAULT_NON_TABLAR_CONTENT.map(e => ({ ...e, fieldId: createNewMongooseId() }))
                            } else {
                                p.nonTabularContent = []
                            }
                            dataToset.pageArray.push(p)
                        })
                        if (doc.ocrClassification === 'IN_PROGRESS' || checkPendingOcrReclassification) {
                            // if (checkPendingOcrReclassification) {
                            process.env.KEY_VALUE_EXTRACT_OCR = 'ENABLED';
                            process.env.KEY_VALUE_EXTRACT_OCR_LAST_ENABLED_AT = new Date()
                            // } else {
                            //     process.env.KEY_VALUE_EXTRACT_OCR = 'DISABLED';
                            // }
                            EMIT_EVENT("SUPER_ADMIN_REFRESH", { opType: "REFRESH", type: "SUPER_ADMIN_REFRESH" });
                        }
                    }
                    // send email alert
                    sendEmail({
                        apiTarget: 'OCR',
                        subject: 'AI_BUGS | IDP | OCR',
                        body: JSON.stringify({
                            environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
                            url: doc.ocrUrl,
                            apiType: 'DOCUMENT_KEY_EXTRACT',
                            keyExtractRetryCount,
                            error: `Timeout for ${pages} pages, with ${expectedOcrTime} miliseconds exceeds`,
                            filePath: doc.s3Url,
                            fileOriginalName: doc.fileOriginalName,
                            documentId: doc._id,
                            idpId: doc.idpid,
                            ocrClassification,
                            clasification: doc.classification
                        }),
                    }).then(() => { }).catch(() => { })
                    if (doc && doc.newPageArray && doc.newPageArray[0]) { // for new Doc's with seprate pages
                        updateDocument({ documentId: doc._id, docType: doc.docType, tenantId: doc.tenantId, idpId: doc.idpId }, dataToset, escb)
                    } else { // for old docs
                        documentService.update({ _id: doc._id }, { $set: dataToset }, null, escb)
                    }
                }, () => { cb() })
            } else {
                cb()
            }
        }],
        process: ['documents', 'retryDocuments', ({ documents, retryDocuments }, cb) => {
            return cb()
            const docs = documents.concat(retryDocuments)
            startProcessing(docs, cb)
        }]
    }, () => {
        callback(true)
    })
}

const processDocumentImages = (doc, callback) => {
    const pages = []
    const originalPages = {}
    const pageImages = {
    }
    const purgeS3Links = []
    let updatedPages = null
    // console.log("start rotating images", doc)
    auto({
        Pages: (cb) => {
            PAGE.find({ documentId: doc._id }).sort({ pageNo: 1 }).lean().exec(cb)
        },
        getRotatedImages: ['Pages', ({ Pages }, cb) => {
            if (Pages && Pages[0]) {
                doc.pageArray = Pages
            }
            if (doc.pageArray && doc.pageArray.length) {
                doc.pageArray.forEach(p => {
                    originalPages[`${p.pageId}`] = p // retain page
                    if (p.rotateByDegree > 0 && (p.page_type === "#NEW_FORMAT#" || doc.ocrClassification === "FAILED")) {
                        pageImages[`${p.pageId}_image`] = p.pageImageLink
                        // pageImages[`${p.pageId}_cover_image`] = p.pageImageLink
                        pages.push(p)
                    }
                })
            }
            if (!pages.length) {
                console.log("page rotation not needed", pages)
                return cb(null, { disableRotation: true }) // skip rotation
            }
            rotateImages({ ...doc, pageArray: pages }).then((r) => cb(null, r)).catch(e => cb(null, { e, error: true }))
        }],
        updateDocument: ['getRotatedImages', ({ Pages, getRotatedImages }, cb) => {
            // update document here
            if (getRotatedImages && getRotatedImages.wait) {
                return cb();
            }
            let dataToSet = {};
            if (getRotatedImages && getRotatedImages.disableRotation) {
                dataToSet.keyExtracted = true // Send to pdf generator
                dataToSet.classification = "STARTED" // Send to pdf generator
            } else if (getRotatedImages && getRotatedImages.s3_link_rotated_list) {
                const pageLength = pages.length // TODO
                pages.forEach((p, i) => {
                    // if (pageImages[`${p.pageId}_image`] === getRotatedImages.s3_link_rotated_list[i]) {
                    purgeS3Links.push(originalPages[`${p.pageId}`].pageImageLink)
                    purgeS3Links.push(originalPages[`${p.pageId}`].s3_thumbnail_path)
                    originalPages[`${p.pageId}`].pageImageLink = getRotatedImages.s3_link_rotated_list[i]
                    if (getRotatedImages && getRotatedImages.dimension_list && getRotatedImages.dimension_list[i]) {
                        originalPages[`${p.pageId}`].dimension = getRotatedImages.dimension_list[i];//
                    }
                    originalPages[`${p.pageId}`].s3_thumbnail_path = getRotatedImages.s3_link_rotated_list[pageLength + i] // todo
                    originalPages[`${p.pageId}`].rotateByDegree = 0 // reset to 0
                    // do nothing
                    // } else {
                    // send alert invalid image url
                    // console.log("GOT INVALID IMAGE URL FROM AI", pageImages[`${p.pageId}_image`], getRotatedImages.s3_link_rotated_list[i])
                    // }
                    // cover image check
                    // if (pageImages[`${p.pageId}_image`] === getRotatedImages.s3_link_rotated_list[i]) {
                    //     // do nothing
                    // } else {
                    //     // send alert invalid image url
                    //     console.log("GOT INVALID IMAGE URL FROM AI", pageImages[`${p.pageId}_image`], getRotatedImages.s3_link_rotated_list[i])
                    // }
                })
                dataToSet.keyExtracted = true // Send to pdf generator
                dataToSet.classification = "STARTED" // Send to pdf generator
                dataToSet.pageArray = Object.values(originalPages)
            } else if (doc.classification === "STARTED" && (getRotatedImages.error)) { // retry once
                dataToSet = {
                    keyExtracted: false,
                    classification: "RETRY"
                };
            } else {
                dataToSet = { aiStatus: "OCR_FAILED", classification: "FAILED", failedStage: 'ROTATE_JPG' } // classification failed
            }
            delete dataToSet.__v
            console.log("dataToSet processDocumentImages", dataToSet)
            if (Pages && Pages[0]) {
                updatedPages = dataToSet.pageArray
                dataToSet.pageArray = []
            }
            documentService.update({ _id: doc._id }, { $set: dataToSet }, { new: true }, cb)
        }],
        updateDocPages: ["updateDocument", ({ Pages }, cb) => {
            console.log("DOC::::::::::::::::::::::::::::::::::::: processDocumentImages")
            if (!(Pages && Pages[0])) {
                return cb()
            }
            updatePages({ documentId: doc._id, idpId: doc.idpId, pageArray: updatedPages }, cb)
        }],
        deleteDocuments: ['updateDocument', ({ updateDocument }, cb) => {
            return cb()
            // if (updateDocument && updateDocument.aiStatus === "OCR_FAILED" && updateDocument.classification === "FAILED") {
            //     documentService.deleteMany({ idpId: updateDocument.idpId, fileName: updateDocument.fileName, _id: { $nin: [updateDocument._id] } }, cb)
            // } else {
            //     cb()
            // }
        }],
        updateBatchBackup: ['updateDocument', (_, cb) => {
            console.log("purge links: ", purgeS3Links);
            IDP_BACKUP.findOneAndUpdate({ idpId: doc.idpId }, { $addToSet: { purgeLinks: purgeS3Links } }, cb)
        }],
        verifyDocumentCount: ['deleteDocuments', (_, cb) => {
            verifyDocumentCount(doc.idpId, false, cb)
        }]
    }, (e) => {
        if (e) {
            console.log("PDF GENERATOR ERROR: ", doc._id, e)
        }
        // EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: doc.tenantId, batchId: doc.idpId, eventType: "FILE_STATUS CHANGED", fileName: doc.fileName });
        callback()
    })
}
const startRotatingImages = (documents, callback) => {
    eachSeries(documents, (doc, cb) => {
        processDocumentImages(doc, cb)
    }, (e, r) => {
        if (e) {
            console.log("ERROR IN KEY EXTRACTION", e)
        }
        callback(e, r)
    })
}
const imageRotater = (callback) => {
    auto({
        serverAvailable: (cb) => {
            // serverAvailable
            if (totalActiveServers() > 0) {
                return cb()
            }
            cb("no server availabe")
        },
        documents: ['serverAvailable', (_, cb) => {
            const criteria = { classification: 'STARTED', keyExtracted: false, ocrClassification: { $in: ['COMPLETED', 'FAILED'] } }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: 10 }, cb)
        }],
        retryDocuments: ['serverAvailable', (_, cb) => {
            const criteria = { classification: 'RETRY', keyExtracted: false, ocrClassification: { $in: ['COMPLETED', 'FAILED'] } }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: 10 }, cb)
        }],
        imageRotate: ['documents', 'retryDocuments', ({ documents, retryDocuments }, cb) => {
            const docs = documents.concat(retryDocuments)
            startRotatingImages(docs, cb)
        }],
    }, () => {
        callback(true)
    })
}
const startPdfGenerator = (callback) => {
    auto({
        serverAvailable: (cb) => {
            // serverAvailable
            if (totalActiveServers() > 0) {
                return cb()
            }
            cb("no server availabe")
        },
        documentsPdfGenerator: ['serverAvailable', (_, cb) => {
            const criteria = { classification: 'STARTED', keyExtracted: true, ocrClassification: { $in: ['NOT_REQUIRED', 'FAILED', 'COMPLETED'] } }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: 10 }, cb)
        }],
        retryDocumentsPdfGenerator: ['serverAvailable', (_, cb) => {
            const criteria = { classification: 'RETRY', keyExtracted: true, ocrClassification: { $in: ['NOT_REQUIRED', 'FAILED', 'COMPLETED'] }, }
            if (process.env.SINGLE_TENANT_ID) {
                criteria.tenantId = process.env.SINGLE_TENANT_ID
            }
            documentService.findAll(criteria, null, { limit: 10 }, cb)
        }],
        processPdfGenerator: ['documentsPdfGenerator', 'retryDocumentsPdfGenerator', ({ documentsPdfGenerator, retryDocumentsPdfGenerator }, cb) => {
            const docs = documentsPdfGenerator.concat(retryDocumentsPdfGenerator)
            startGeneratingFileForDocument(docs, cb)
        }],
    }, () => {
        callback(true)
    })
}
const checkFileReviewed = (doc, isBatchReviewed = false, qcFromSupervisorScreen, callback) => {
    auto({
        docCount: (cb) => {
            const criteria = { idpId: doc.idpId, fileName: doc.fileName }
            if (isBatchReviewed) {
                delete criteria.fileName
            }
            console.log("docCount criteria: isBatchReviewed:", criteria, isBatchReviewed)
            documentService.count(criteria, cb)
        },
        docIndexerReviewCount: (cb) => {
            const criteria = {
                idpId: doc.idpId, fileName: doc.fileName, qcStatus: { $in: ["ASSIGNED_SUPERVISOR", "COMPLETED"] }
            }
            if (isBatchReviewed) {
                delete criteria.fileName
            }
            if (qcFromSupervisorScreen) {
                criteria.qcStatus = { $in: ["COMPLETED"] }
            }
            console.log("docIndexerReviewCount criteria: isBatchReviewed qcFromSupervisorScreen", criteria, isBatchReviewed, qcFromSupervisorScreen)
            documentService.count(criteria, cb)
        }
    }, (err, { docCount, docIndexerReviewCount }) => {
        console.log("docCount, docIndexerReviewCount: isBatchReviewed", docCount, docIndexerReviewCount, isBatchReviewed)
        if (err) {
            console.log("checkFileReviewed ERROR :", err)
            return callback(null, false)
        }
        callback(null, docCount === docIndexerReviewCount)
    })
}
// temporary change for indexer to review percent
const USERS = {}
// console.log("process.env.EMAILIDS", JSON.parse(process.env.INDEXER_EMAILIDS))
if (process.env.INDEXER_EMAILIDS) {
    JSON.parse(process.env.INDEXER_EMAILIDS).forEach(u => {
        USERS[u.email] = u.percent
    })
}
console.log("indexer users to force review %:::", USERS)
/**
 * fileSendToSupervisor
 */
const fileSendToSupervisor = (doc, callback) => {
    console.log("debug");
    const startOfDay = new Date(new Date().setUTCHours(0, 0, 0, 0))
    const endOfDay = new Date(new Date().setUTCHours(23, 59, 59, 999))
    const currentDayRange = {
        $gte: startOfDay,
        $lt: endOfDay
    }
    auto({
        // isFileReviewed: (cb) => {
        //     checkFileReviewed(doc, false, false, cb)
        // },
        isBatchReviewed: (cb) => {
            checkFileReviewed(doc, true, false, (err, batchReviewed) => {
                if (!batchReviewed) {
                    return cb("Batch Not reviewed completly yet")
                }
                cb(null, true)
            })
        },
        sampleSize: (cb) => {
            console.log("USERS[doc.email]::: ", doc.email, USERS[doc.email])
            if (USERS && USERS[doc.email]) {
                console.log("FORCE QC")
                return cb(null, USERS[doc.email]);
            }
            return checkReviewPercent(doc, cb)
            CUSTOMER.findOne({ customersArray: doc.externalCustomerId, tenantId: doc.tenantId }, (err, customerSetting) => {
                const sampleSize = (customerSetting && customerSetting.reviewPercent)
                console.log("SAMPLE SIZE original for externalCustomerId,sampleSize ", doc.externalCustomerId, sampleSize)
                if (err) {
                    console.log("err fileSendToSupervisor sampleSize: ", err)
                }
                cb(null, sampleSize)
            })
        },
        totalreviewCount: ['isBatchReviewed', 'sampleSize', ({ isBatchReviewed, sampleSize }, cb) => {
            if (!isBatchReviewed || !sampleSize || (sampleSize && sampleSize === 100)) {
                return cb()
            }
            const criteria = {
                tenantId: doc.tenantId,
                aiStatus: "OCR_COMPLETE",
                externalCustomerId: doc.externalCustomerId,
                qcStatus: { $in: ["ASSIGNED_SUPERVISOR", "COMPLETED"] },
                reviewedAt: currentDayRange,
                reviewedBy: createMongooseId(doc.userId)
            }
            console.log("criter totalreviewCount:", criteria)
            documentService.aggregation([
                { $match: criteria, },
                {
                    $group: {
                        _id: "$idpId"
                    }
                },
                {
                    $group: {
                        _id: null,
                        reviewedCount: { $sum: 1 },
                    }
                }
            ], (err, res) => {
                if (err || !(res && res[0])) {
                    return cb(null, 0)
                }
                const result = res && res[0];
                cb(null, result.reviewedCount || 0)
            })
        }],
        assignToSupervisor: ['sampleSize', 'totalreviewCount', (data, cb) => {
            const { sampleSize, totalreviewCount = 0, isBatchReviewed = false } = data;
            let assignBatchToSupervisor = false
            let dataToSet = {}
            if (isBatchReviewed) {
                dataToSet = { ...dataToSet, reviewStartedLockBy: null, reviewStartedLockAt: null } // mark file as reviewed
                if (sampleSize && totalreviewCount) {
                    const filesIntervalCount = 100 / sampleSize; // calculate file no to be assigned as 5th or 6th reviewed file etc
                    const assignReminder = totalreviewCount % filesIntervalCount
                    if (assignReminder < 1) {
                        assignBatchToSupervisor = true
                    }
                }
                if (sampleSize && sampleSize === 100) {
                    assignBatchToSupervisor = true
                }
            }
            console.log('assignBatchToSupervisor sampleSize', sampleSize)
            console.log('assignBatchToSupervisor: ', assignBatchToSupervisor)
            if (sampleSize === 0) {
                assignBatchToSupervisor = false;
                console.log('assignBatchToSupervisor settoFalse')
            }
            if (assignBatchToSupervisor) {
                dataToSet.qcStatus = "ASSIGNED_SUPERVISOR"
                dataToSet.classification = "ASSIGNED_SUPERVISOR"
            }
            console.log("assignToSupervisor data dataToSet : ", data, dataToSet)
            if (!Object.keys(dataToSet).length) {
                return cb()
            }
            console.log('checking dataToSet in senttoqc', dataToSet)
            documentService.updateAll({ idpId: doc.idpId, reviewRole: INDEXER }, { $set: dataToSet }, null, (err, res) => {
                if (dataToSet.qcStatus === "ASSIGNED_SUPERVISOR") {
                    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: doc.tenantId, eventType: "FILE_LIST_SUPERVISOR" });
                }
                EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId: doc.tenantId, batchId: doc.idpId, eventType: "FILE_STATUS CHANGED", fileName: doc.fileName });
                cb(err, res)
            })
        }]
    }, (error) => {
        if (error) {
            console.log("fileSendToSupervisor: ", error)
        }
        callback()
    })
}
module.exports = {
    reClassifyDocumentsPages,
    startKeyValueExtract,
    startPdfGenerator,
    checkFileReviewed,
    fileSendToSupervisor,
    imageRotater
};
