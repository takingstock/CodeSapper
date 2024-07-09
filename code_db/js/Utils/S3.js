const { auto, eachSeries } = require('async')
const moment = require('moment');
const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')
const { documentService, VendorsService, bolVendorsService } = require('../Services')
const { isValidUrl } = require('./universal-functions.util')
const IDP_BACKUP = require('../Models/idp-documentlist-backup.model');

const sizeOf = async (s3, params) => {
    try {
        const fileSize = await s3.headObject(params)
            .promise()
        return fileSize
    } catch (err) {
        console.log("s3 File size check fail")
        return { err }
    }
}
const _fileSendToPurging = (filePath) => {
    const fileName = path.basename(filePath);
    auto({
        doc: (cb) => {
            documentService.updateAll({ fileName }, { $set: { fileDownloadedAt: new Date() } }, null, cb)
        },
    }, () => {
        console.log("FILE READY TO GET PURGED", fileName)
    })
}

const _fileNameFromS3Path = (url) => {
    if (!url) {
        return ''
    }
    const partition = url.split('/')
    return partition[partition.length - 1]
}
const s3FileUpload = async (file, fileName) => {
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    })
    //console.log("imagePath: ", process.env.AWS_S3_ACCESS_KEY_ID, process.env.AWS_S3_BUCKET_NAME)

    const blob = file
    const filePathToSave = path.join(process.env.NODE_ENV, process.env.AWS_S3_FOLDER_PATH, fileName)
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: filePathToSave,
    }
    try {
        const imageUploaded = await s3.upload({ ...params, Body: blob }).promise()
        //console.log("file upload s3 befrore: ", imageUploaded)
        const fileDetails = await sizeOf(s3, params)
        imageUploaded.ContentLength = (fileDetails && fileDetails.ContentLength) || 0
        //console.log("file upload s3 after: ", imageUploaded)
        return imageUploaded
    } catch (err) {
        console.log("file upload s3:", err)
        return { err }
    }
}

/**
 * read file as stream from
 *  downloadFromS3 to true will delete file from s3 after 24 hours
 * @param {*} fileReference
 * @param {*} downloadFromS3
 * @returns
 */
const readfileFromStream = (s3path, downloadFromS3 = false) => {
    console.log("in readfileFromStream")
    if (!downloadFromS3 && !isValidUrl(s3path)) {
        return fs.createReadStream(s3path)
    }
    if (downloadFromS3) { // make file ready to purge
        _fileSendToPurging(s3path);
    }
    console.log("in readfileFromStream s3")
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    })
    const fileName = _fileNameFromS3Path(s3path)
    const filePathToSave = path.join(process.env.NODE_ENV, process.env.AWS_S3_FOLDER_PATH, fileName);
    console.log("KEY", fileName)
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: filePathToSave,
    }
    const fileStream = s3.getObject(params).createReadStream();
    return fileStream
}

const readfile = async ({ s3path, downloadFromS3 = false, docType }) => new Promise((resolve, reject) => {
    console.log("in readfile", s3path)
    if (!downloadFromS3) {
        return resolve({ filePath: s3path })
    }
    console.log("in readfile s3")
    auto({
        downloadFileS3: (cb) => {
            return cb()
            const s3 = new AWS.S3({
                accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            })
            const fileName = _fileNameFromS3Path(s3path)
            const filePathToSave = path.join(process.env.NODE_ENV, process.env.AWS_S3_FOLDER_PATH, fileName);
            console.log("KEY", fileName)
            const params = {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: filePathToSave,
            }
            const newFilePath = path.join(__dirname, '../../', '/uploads/downloads', `${new Date().toString()}_${path.basename(filePathToSave)}`);
            console.log("starte reading file : ", fileName, newFilePath)
            const fileStream = s3.getObject(params).createReadStream();
            fileStream
                .pipe(fs.createWriteStream(newFilePath))
                .on('error', (e) => {
                    return reject(e)
                })
                .on("finish", () => {
                    return cb(null, newFilePath)
                })
        },
        timeStampVendorListUpdated: (cb) => {
            if (docType === "BOL") {
                return cb()
            }
            VendorsService.findOne({}, null, null, (err, vendor) => {
                cb(null, vendor && (vendor.createdAt || vendor.updatedAt))
            })
        },
        timeStampBolVendorListUpdated: (cb) => {
            if (docType !== "BOL") {
                return cb()
            }
            bolVendorsService.findOne({}, null, null, (err, vendor) => {
                cb(null, vendor && (vendor.createdAt || vendor.updatedAt))
            })
        }
    }, (e, { downloadFileS3, timeStampVendorListUpdated, timeStampBolVendorListUpdated }) => {
        if (e) {
            console.log("S3 download error", e)
        }
        resolve({ filePath: downloadFileS3, s3: true, timeStampVendorListUpdated: timeStampVendorListUpdated || timeStampBolVendorListUpdated })
    })
})
const newVendorListAddedAt = ({ docType }) => new Promise((resolve) => {
    auto({
        timeStampVendorListUpdated: (cb) => {
            if (docType === "BOL") {
                return cb()
            }
            VendorsService.findOne({}, null, null, (err, vendor) => {
                cb(null, vendor && (vendor.createdAt || vendor.updatedAt))
            })
        },
        timeStampBolVendorListUpdated: (cb) => {
            if (docType !== "BOL") {
                return cb()
            }
            bolVendorsService.findOne({}, null, null, (err, vendor) => {
                cb(null, vendor && (vendor.createdAt || vendor.updatedAt))
            })
        }
    }, (e, { timeStampVendorListUpdated, timeStampBolVendorListUpdated }) => {
        // VendorsService.findOne({}, null, null, (err, vendor) => {
        // })
        resolve({ timeStampVendorListUpdated: timeStampVendorListUpdated || timeStampBolVendorListUpdated })
    })
})
const getSingedUrl = (s3PathUrl, callback) => {
    if (!s3PathUrl) {
        return s3PathUrl
    }
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    })
    // const filePathToSave = isValidUrl(s3PathUrl) ? s3PathUrl.split('/').splice(3).join('/') : s3PathUrl
    const filePathToSave = s3PathUrl.split('/').splice(3).join('/')

    const Key = filePathToSave.replace(`${process.env.AWS_S3_BUCKET_NAME}/`, '');
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key,
        Expires: 60 * 35
    };
    // console.log("params: ", params)
    s3.getSignedUrl('getObject', params, callback)
}
/**
 * Delete file from s3
 * @param {*} s3path
 * @param {*} callback
 */
const deleteFileFromS3 = (s3path, callback) => {
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    })
    const fileName = _fileNameFromS3Path(s3path)
    const filePathToDelete = path.join(process.env.NODE_ENV, process.env.AWS_S3_FOLDER_PATH, fileName);
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: filePathToDelete,
    }
    s3.deleteObject(params, callback);
}
/**
 * Delete document file from s3
 * @param {*} s3path
 * @param {*} callback
 */
const deleteDocumentFileFromS3 = (s3PathUrl, callback) => {
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    })
    let filePathToDelete = s3PathUrl.split(`${process.env.AWS_S3_BUCKET_NAME}/`)[1]
    if (!filePathToDelete) {
        const fileName = _fileNameFromS3Path(s3PathUrl)
        filePathToDelete = path.join(process.env.NODE_ENV, process.env.AWS_S3_FOLDER_PATH, fileName);
    }
    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: filePathToDelete,
    }
    s3.deleteObject(params, callback);
}
const purgeFile = (s3Url, callback) => {
    auto({
        delete: (cb) => deleteFileFromS3(s3Url, cb),
        update: (cb) => documentService.updateAll({ s3Url }, { $set: { fileDeleted: true } }, null, cb)
    }, callback)
}
const purgeDocumentFile = ({ _id, idpId, s3DocumentPdfLink, s3Url, s3_link_final_output, s3_ocr_path_output, pageArray = [] }, callback) => {
    auto({
        backUplinks: (cb) => {
            IDP_BACKUP.findOne({ idpId }, { purged: 1, purgeLinks: 1 }, (err, Backup) => {
                if (!err && Backup && !Backup.purged) {
                    cb(null, Backup.purgeLinks || [])
                } else {
                    cb(null, [])
                }
            })
        },
        delete: ['backUplinks', ({ backUplinks }, cb) => {
            const s3fileLinks = [...backUplinks, s3DocumentPdfLink, s3Url, s3_link_final_output, s3_ocr_path_output]
            pageArray.forEach(p => {
                s3fileLinks.push(p.pageImageLink)
                s3fileLinks.push(p.s3_path_ocr)
                s3fileLinks.push(p.s3_path_ocr_stitched)
                s3fileLinks.push(p.s3_thumbnail_path)
            })

            const finalPurgeLinks = [...new Set(s3fileLinks)].filter(f => f)
            console.log("final purgeLinks", finalPurgeLinks)
            eachSeries(finalPurgeLinks, (s3DocumentPdfLink, ecb) => {
                deleteDocumentFileFromS3(s3DocumentPdfLink, (e) => {
                    if (e) {
                        console.log("ERROR WILHE PURGING A FILE :", s3DocumentPdfLink);
                        console.log(e)
                    }
                    ecb()
                })
            }, cb)
        }],
        update: (cb) => documentService.updateAll({ _id }, { $set: { documentDeleted: true } }, null, cb)
    }, callback)
}

const startPurgingFiles = (callback) => {
    const time = moment.duration("24:00:00");
    const date = moment();
    const finalDate = date.subtract(time);
    const filedExists = { $exists: true, $ne: null }
    auto({
        uploadedfiles: (cb) => {
            return cb();
            const match = { fileDownloadedAt: { ...filedExists, $lte: new Date(finalDate) }, s3Url: filedExists, fileDeleted: false }
            documentService.aggregation([{ $match: match }, { $group: { _id: "$s3Url" } }], cb);
        },
        documentFiles: (cb) => {
            const match = { documentDownloadedAt: { ...filedExists, $lte: new Date(finalDate) }, s3DocumentPdfLink: filedExists, documentDeleted: false }
            documentService.findAll(match, { _id: 1, s3_link_final_output: 1, s3Url: 1, s3DocumentPdfLink: 1, s3_ocr_path_output: 1, "pageArray.s3_thumbnail_path": 1, "pageArray.pageImageLink": 1, "pageArray.s3_path_ocr": 1, "pageArray.s3_path_ocr_stitched": 1 }, null, cb)
        },
        updateFiles: ['uploadedfiles', ({ uploadedfiles }, cb) => {
            return cb();
            eachSeries(uploadedfiles, (file, ecb) => {
                purgeFile(file._id, ecb)
            }, cb)
        }],
        updateDocuments: ['documentFiles', ({ documentFiles }, cb) => {
            eachSeries(documentFiles, (document, ecb) => {
                purgeDocumentFile(document, ecb)
            }, cb)
        }]
    }, () => {
        callback(true)
    })
}

module.exports = {
    s3FileUpload,
    readfileFromStream,
    deleteFileFromS3,
    readfile,
    newVendorListAddedAt,
    deleteDocumentFileFromS3,
    startPurgingFiles,
    getSingedUrl
};

// setTimeout(() => {
//     const url = "myFIle (9).pdf"
//     getSingedUrl(url, (err, u) => {
//         console.log("KKKKKKKKKKKKKKKKKKKKKKKKKKKKK: ", u)
//     }, 1000)
// })
