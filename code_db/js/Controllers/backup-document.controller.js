const config = require('config');
const { auto, eachSeries } = require('async');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const BACKUP_DOCUMENT = require("../Models/backup-document.model")
const { documentService } = require("../Services")

const ERR_MESSAGES = config.get('ERR_MESSAGES');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');

const getSavedDocumentDetail = (_, { docId }, callback) => {
    let document = null
    auto({
        Docs: (cb) => {
            BACKUP_DOCUMENT.find({ documentId: docId }).lean().exec(cb)
        },
        mergeDocsPages: ['Docs', ({ Docs }, cb) => {
            if (Docs[0] && !Docs[0].pageId) {
                document = Docs[0] && Docs[0].document;
                return cb()
            }
            Docs.forEach(d => {
                // console.log("getSavedDocumentDetail d", d)
                if (d && d.document && d.document.pageArray) {
                    if (!document) {
                        document = { ...d.document, pageArray: [d.document.pageArray] }
                    } else {
                        document.pageArray.push(d.document.pageArray)
                    }
                }
            })
            cb()
        }]
    }, () => {
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: document && { documentId: docId, document } })
    })
}

const saveDocumentPages = (docId, document, callback) => {
    // console.log("saveDocumentPages docId", docId)
    // console.log("saveDocumentPages document", document)
    eachSeries(document.pageArray, (page, ecb) => {
        const doc = { ...document, pageArray: page }
        // console.log("saveDocumentPages doc", doc);
        // console.log("saveDocumentPages doc", JSON.stringify(doc));
        BACKUP_DOCUMENT.findOneAndUpdate({ documentId: docId, pageId: page.pageId }, { $set: { documentId: docId, pageId: page.pageId, document: doc } }, { upsert: true }, ecb)
    }, callback)
}

const saveDocumentDetail = (_, { docId }, payload, callback) => {
    const { document = null } = payload || {}
    // const data = { documentId: docId, document }
    if (!document) {
        return callback(null, { ...ERR_MESSAGES.BAD_REQUEST, message: "document can't be null" });
    }
    auto({
        checkDocument: (cb) => {
            documentService.findOne(
                { _id: docId }, { _id: 1 }, null, null,
                (err, result) => {
                    if (err) {
                        return cb(err);
                    }
                    if (!result) {
                        return cb(HTTP_ERROR_MESSAGES.NO_DOC_FOUND);
                    }
                    return cb(null, result);
                },
            );
        },
        Doc: ['checkDocument', (_, cb) => {
            saveDocumentPages(docId, document, cb)
        }]
    }, (e) => {
        if (e) {
            return callback(e)
        }
        callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}
module.exports = {
    getSavedDocumentDetail,
    saveDocumentDetail,
};
