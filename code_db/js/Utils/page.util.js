const { auto, eachLimit } = require('async');
const PAGE = require('../Models/page.model');
const PAGE_BACKUP = require('../Models/page-backup.model');

const createPages = ({ documentId, pageArray, idpId, backup = true, fileName, tenantId }, callback) => {
    auto({
        createPage: (cb) => {
            eachLimit(pageArray, 10, (page, ecb) => {
                page.documentId = documentId
                page.idpId = idpId
                page.fileName = fileName
                page.tenantId = tenantId
                auto({
                    createPage: (acb) => {
                        new PAGE(page).save(acb)
                    },
                    backupPage: (acb) => {
                        if (!backup) {
                            return acb()
                        }
                        new PAGE_BACKUP(page).save(acb)
                    }
                }, ecb)
            }, cb)
        }
    }, callback)
}

const updatePages = ({ documentId, idpId, pageArray, updateKeys = null }, callback) => {
    auto({
        createPage: (cb) => {
            if (!(pageArray && pageArray.length)) {
                return cb()
            }
            console.log("Start updating creating pages")
            eachLimit(pageArray, 10, (page, ecb) => {
                let dataToSet = {}
                if (updateKeys && updateKeys.length) {
                    updateKeys.forEach(k => {
                        dataToSet[k] = page[k]
                    });
                } else {
                    dataToSet = { ...page, ...dataToSet }
                }
                if (idpId) {
                    dataToSet.idpId = idpId
                }
                if (documentId) {
                    dataToSet.documentId = documentId
                }
                delete dataToSet._id
                delete dataToSet.__v
                // console.log("...........PAGE.........dataToSet:", JSON.stringify(dataToSet))
                console.log("...........PAGE.........criteria:", { pageId: page.pageId, documentId })
                PAGE.findOneAndUpdate({ pageId: page.pageId }, { $set: dataToSet }, { upsert: true }, ecb) // enhancements needed update only modified data from page Array
            }, cb)
        }
    }, callback)
}
module.exports = {
    createPages,
    updatePages
}
