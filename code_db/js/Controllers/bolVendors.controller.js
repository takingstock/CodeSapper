const config = require('config');
const { auto } = require('async');
const moment = require('moment-timezone');
const fsXtra = require('fs-extra');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const excelToJson = require('convert-excel-to-json');
const XLSX = require('xlsx');
const CSV = require('csvtojson')
// const {
//     v1: uuidv1
// } = require('uuid');
// const XLSX = require('xlsx');

const _pathToDownloads = path.join(__dirname, '../../', '/uploads/downloads');
const { createMongooseId } = require('../Utils/universal-functions.util');
const { bolVendorsService, customersService } = require('../Services');
const { readVendorXcelFile } = require('../Utils/excel')
const { getFileSizeInBytes } = require('../Utils/universal-functions.util')
// const dashboardReportController = require('./dashboard-report.controller');
const { sendEmail } = require('../Utils/imc-endpoints.util');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const APP_CONSTANTS_STATUS_MSG = config.get('STATUS_MSG');

const fileUploader = (file, path, callback) => {
    /** Used for saving a file in storage */

    if (!file) {
        callback(APP_CONSTANTS_STATUS_MSG.ERROR.FILE_UPLOAD.INVALID_FILE);
    }
    const fileStream = fs.createWriteStream(path);
    file.pipe(fileStream)
        .on('error', (e) => {
            console.error(e);
            callback(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
        })
        .on("finish", () => {
            const fileSize = getFileSizeInBytes(path);
            const fileName = file.hapi.filename;
            const returnObj = {
                fileName,
                fileSize
            }
            callback(null, returnObj);
        })
}
const validateJsonFormat = (resultInJson) => {
    const keys = Object.keys(resultInJson)
    let isCorrectFormat = true
    for (const key of keys) {
        isCorrectFormat = key === 'customerId' ? typeof resultInJson[key] === 'number' : true
        if (!isCorrectFormat) {
            return isCorrectFormat
        }
    }
    return isCorrectFormat
}
const uploadNewBolVendors = (user, payload, callback) => {
    console.log("inside upload new vendors", user.tenantId, payload);
    // let lastEntryDate = null
    const starttimer = new Date().getTime()
    const name = payload.file.hapi.filename;
    if (name && name.length) {
        const fileExt = name.split('.').pop().toLowerCase();
        if (fileExt !== 'xlsx') {
            return callback(APP_CONSTANTS_STATUS_MSG.ERROR.FILE_UPLOAD.EXT_NOT_ALLOWED);
        }
    }
    let resultInJson = []
    let numberOfColumns = 0
    const filename = `bolVendorListLatest.xlsx`;
    const tempfile = 'tempBolVendorList.xslx'
    const filePath = `${_pathToDownloads}/${filename}`;
    const tempFilePath = `${_pathToDownloads}/${tempfile}`;
    // callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT });
    auto({
        uploadFile: (cb) => {
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    fileUploader(payload.file, tempFilePath, (err, resultObj) => {
                        if (err) {
                            console.error("file uploader err: ", err);
                            cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                        } else {
                            console.log("File Upload Result:", resultObj);
                            cb();
                        }
                    })
                })
                .catch(err => {
                    console.error("Directory ensure err: ", err);
                    cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                });
        },
        getNumberOfSheetsInExcel: ['uploadFile', (res, cb) => {
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    resultInJson = excelToJson({
                        sourceFile: tempFilePath,
                    });
                    const workbook = XLSX.readFile(tempFilePath, { sheetRows: 2 });
                    console.log("workbooks>>>>", Object.keys(workbook.Sheets).length)
                    // console.log("workbooks>>>>", workbook.Sheets["Sheet1"])
                    if (workbook && workbook.Sheets && (Object.keys(workbook.Sheets).length !== 1 || workbook.Sheets["Sheet1"] === undefined || workbook.Sheets["Sheet1"] === null)) {
                        return cb({
                            ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                            message: "Bad Workbooks in File"
                        })
                    }
                    cb()
                })
                .catch(err => {
                    console.error("Directory ensure err: ", err);
                    cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                });
        }],
        readXLSXFormat: ['getNumberOfSheetsInExcel', (res, cb) => {
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    resultInJson = excelToJson({
                        sourceFile: tempFilePath,
                        range: `A1:D1`,
                        sheets: [`Sheet1`],
                        columnToKey: {
                            A: 'customerId',
                            B: 'vendorId',
                            C: 'vendorName',
                            D: 'vendorAddress'
                        }
                    });
                    const workbook = XLSX.readFile(tempFilePath, { sheetRows: 2 });
                    const json = XLSX.utils.sheet_to_json(workbook.Sheets["Sheet1"]);
                    if (json && json.length) {
                        numberOfColumns = Object.keys(json[0]).length
                        console.log("json:::::", json[0], numberOfColumns)
                    }
                    console.log("resultInJson upload vendor:::", resultInJson)
                    cb(null, resultInJson)
                })
                .catch(err => {
                    console.error("Directory ensure err: ", err);
                    cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                });
        }],
        checkXLSXFormat: ['readXLSXFormat', (res, cb) => {
            // return cb()
            if (resultInJson && resultInJson["Sheet1"] && !resultInJson["Sheet1"].length) {
                console.log("no resultInJson in file")
                return cb({
                    ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                    message: "Invalid File"
                })
            }
            if (resultInJson && (!resultInJson.Sheet1[0].customerId || !resultInJson.Sheet1[0].vendorId
                || !resultInJson.Sheet1[0].vendorName || !resultInJson.Sheet1[0].vendorAddress)) {
                return cb({
                    ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                    message: "Missing Columns in File"
                })
            }
            if (resultInJson && (!validateJsonFormat(resultInJson.Sheet1[0]) || numberOfColumns !== 4)) {
                return cb({
                    ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                    message: "Bad Columns in File"
                })
            }
            cb()
            callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                message: "File is uploaded. Please wait for 5-10 mins depending on file size before changes are reflected"
            })
        }],
        backupOldVendorFile: ['checkXLSXFormat', (res, cb) => {
            // return cb()
            const date = moment().tz("Asia/Kolkata").format('YYYY-MM-DD HH:mm:ss').replace(" ", "")
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    fsXtra.pathExists(filePath)
                        .then((isExists) => {
                            let command = ``
                            if (isExists) {
                                command += `mv ${filePath} ${_pathToDownloads}/bolVendorListBackup${date}.xlsx`
                            }
                            if (command.length) {
                                command += ` && mv ${tempFilePath} ${filePath}`
                            } else {
                                command += `mv ${tempFilePath} ${filePath}`
                            }
                            const child = spawn(command, {
                                shell: true,
                            });

                            child.stderr.on('data', (data) => {
                                console.error('STDERR:', data.toString());
                            });
                            child.stdout.on('data', (data) => {
                                console.log('STDOUT:', data.toString());
                            });
                            child.on('exit', (exitCode) => {
                                console.log(`Child vendor exited with code: ${exitCode}`);
                                cb();
                            });
                        })
                        .catch((err) => {
                            console.error('key generation error:', err);
                            cb(err);
                        });
                })
                .catch((err) => {
                    console.error('Path ensure error:', err);
                    cb(err);
                });
        }],
        clearVendorCollection: ["backupOldVendorFile", (res, cb) => {
            // return cb()
            console.log("inside clearVendorCollection")
            bolVendorsService.deleteMany({}, (err) => {
                if (err) {
                    cb(err)
                }
                cb()
            })
        }],
        readAndInsertNewFile: ["clearVendorCollection", (res, cb) => {
            // return cb()
            readVendorXcelFile(filePath, (err, result) => {
                if (err) {
                    return cb(err)
                }
                console.log("readVendorXcelFile result::", result)
                cb()
            })
        }],

    },
        (err) => {
            const mailObj = {}
            if (err) {
                const endTime = new Date().getTime()
                mailObj["subject"] = `Upload BOL Vendor failed`
                mailObj["body"] = `Something went wrong while uploading vendor. Uploaded by ${user.email} Total time taken: ${endTime - starttimer}ms`
                console.error("VENDOR UPLOAD FAILED", err)
                callback(err)
            } else {
                const endTime = new Date().getTime()
                mailObj["subject"] = `Upload BOL Vendor Success`
                mailObj["body"] = `Successfully uploaded new vendors file. Uploaded by ${user.email} Total time taken: ${endTime - starttimer}ms`
            }
            sendEmail({
                subject: mailObj.subject,
                body: mailObj.body,
                apiTarget: 'DEV_TESTING'
            }).then(() => { callback() }).catch((e) => { console.error("Error while sending mail::", e); callback(e) });
            console.log("SUCCESSFULLY UPLOADED NEW VENDORS FILE");
        })
}

const fetchBolVendors = (user, { offset = 0, limit = 10, externalCustomerId = null, q: searchItem, searchFilter = "overall", aiFilterActive = "false" }, hcb) => {
    console.log("in fetchVendors")
    let criteria = {}
    if (searchItem) {
        if (searchFilter === "overall") {
            criteria = { $or: [{ vendorId: searchItem }, { customerId: searchItem }, { vendorName: { $regex: searchItem, '$options': 'i' } }, { vendorAddress: { $regex: searchItem, '$options': 'i' } }] }
        } else if (searchFilter === "vendorId") {
            criteria = { vendorId: searchItem }
        } else if (searchFilter === "customerId") {
            criteria = { customerId: searchItem }
        } else if (searchFilter === "vendorName") {
            criteria = { vendorName: { $regex: searchItem, '$options': 'i' } }
        } else if (searchFilter === "vendorAddress") {
            criteria = { vendorAddress: { $regex: searchItem, '$options': 'i' } }
        }
        if (aiFilterActive) {
            criteria = { $or: [{ vendorName: { $regex: searchItem, '$options': 'i' } }, { vendorAddress: { $regex: searchItem, '$options': 'i' } }] }
        }
    }
    if (externalCustomerId) {
        criteria.customerId = externalCustomerId
    }
    auto({
        count: (cb) => {
            bolVendorsService.count(criteria, cb)
        },
        list: (cb) => {
            // console.log("vendor fetch criteria, offset, limit::::::", JSON.stringify(criteria), offset, limit)
            bolVendorsService.findAll(criteria, {}, { offset, limit, }, cb)
        }
    }, (err, { count, list }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { totalCount: count, ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: list })
    })
}
const bolVendorDetail = (user, query, hcb) => {
    bolVendorsService.findOne({ vendorId: query.vendorId, customerId: query.customerId }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}
const fetchAllBolCustomers = ({ tenantId }, q, hcb) => {
    const arr = []
    console.log('Fetching customers, tenantID', q, tenantId)
    let vendorListCustomerArray = []
    let defaultTeamCustomerArray = []
    let finalCusotmerList = []
    auto({
        getCustomersFromVendorList: (cb) => {
            const criteria = {}
            if (q.q) {
                criteria['customerId'] = { $regex: q.q, $options: 'i' }
            }
            // console.log("getCustomersFromVendorList criteria:", criteria)
            bolVendorsService.findAll(criteria, { customerId: 1 }, { lean: true }, (err, hooks) => {
                if (err) {
                    return cb(err)
                }
                for (let i = 0; i < hooks.length; i++) {
                    if (arr.indexOf(hooks[i].customerId) === -1) {
                        arr.push(hooks[i].customerId)
                    }
                }
                vendorListCustomerArray = arr
                // console.log("vendorListCustomerArray length:", vendorListCustomerArray.length)
                // console.log("vendorListCustomerArray length:", vendorListCustomerArray)
                return cb()
            })
        },
        getCustomersFromDefaultTeam: (cb) => {
            const criteria = { isDefault: true, tenantId }
            // console.log("getCustomersFromDefaultTeam criteria", criteria)
            customersService.findAll(criteria, { customersArray: 1 }, { lean: true, new: true }, (err, response) => {
                if (err) {
                    return cb(err);
                }
                console.log("response::::", response)
                if (response.length) {
                    defaultTeamCustomerArray = response[0].customersArray
                    // console.log("defaultTeamCustomerArray-->", defaultTeamCustomerArray.length);
                    // console.log("defaultTeamCustomerArray-->", defaultTeamCustomerArray);
                }
                cb();
            })
        },
        mergeLists: ['getCustomersFromVendorList', 'getCustomersFromDefaultTeam', (_, cb) => {
            finalCusotmerList = vendorListCustomerArray.concat(defaultTeamCustomerArray.filter((item) => (q.q ? (item.startsWith(q.q) && vendorListCustomerArray.indexOf(item) < 0) : vendorListCustomerArray.indexOf(item) < 0)));
            cb()
        }]
    }, (err) => {
        if (err) {
            console.log("fetchCustomers err:", err)
        }
        hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: finalCusotmerList })
    })
}
const createBolVendor = (user, payload, hcb) => {
    const tenantId = createMongooseId(user.tenantId);
    if (!tenantId) {
        return hcb({
            statusCode: 404,
            message: 'tenantId is required',
        })
    }
    bolVendorsService.create({
        tenantId,
        vendorId: payload.vendorId,
        customerId: payload.customerId,
        vendorName: payload.vendorName,
        vendorAddress: payload.vendorAddress,
    }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}
const updateBolVendor = (user, payload, hcb) => {
    // const tenantId = createMongooseId(user.tenantId);
    // if (!tenantId) {
    //     return hcb({
    //         statusCode: 404,
    //         message: 'tenantId is required',
    //     })
    // }
    const criteria = {
        _id: payload._id
    }
    const data = { updatedBy: user.id }
    if (payload.vendorId) {
        data.vendorId = payload.vendorId;
    }
    if (payload.customerId) {
        data.customerId = payload.customerId
    }
    if (payload.vendorName) {
        data.vendorName = payload.vendorName
    }
    if (payload.vendorAddress) {
        data.vendorAddress = payload.vendorAddress
    }
    console.log("criteria update", criteria)
    bolVendorsService.update(criteria, { $set: data }, { new: true }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}
const deleteBolVendor = (user, query, hcb) => {
    const criteria = {
        _id: query._id
    }
    console.log("criteria dlete:", criteria)
    bolVendorsService.deleteOne(criteria, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        console.log("hooks", hooks)
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

// new upload section
let vendorInProgress = false

function convertXLSToCSV(payload, cb) {
    fsXtra.pathExists(payload.tempFilePath)
        .then((isExists) => {
            let command = ``
            if (isExists) {
                command += `in2csv --sheet Sheet1 ${payload.tempFilePath} > ${payload.tempCSVFilePath}`
            }
            const child = spawn(command, {
                shell: true,
            });

            child.stderr.on('data', (data) => {
                console.error('convertXLSToCSV STDERR:', data.toString());
            });
            child.stdout.on('data', (data) => {
                console.log('convertXLSToCSV STDOUT:', data.toString());
            });
            child.on('exit', (exitCode) => {
                console.log(`convertXLSToCSV Child vendor exited with code: ${exitCode}`);
                cb(null, exitCode);
            });
        })
        .catch((err) => {
            console.error('convertXLSToCSV to csv error:', err);
            cb(err);
        });
}

function getFewRowsOfcsv(payload, cb) {
    fsXtra.pathExists(payload.tempCSVFilePath)
        .then((isExists) => {
            let command = ``
            if (isExists) {
                command += `head -5 ${payload.tempCSVFilePath} > ${payload.minTempCSVFilePath}`
            }
            const child = spawn(command, {
                shell: true,
            });

            child.stderr.on('data', (data) => {
                console.error('getFewRowsOfcsv STDERR:', data.toString());
            });
            child.stdout.on('data', (data) => {
                console.log('getFewRowsOfcsv STDOUT:', data.toString());
            });
            child.on('exit', (exitCode) => {
                console.log(`getFewRowsOfcsv Child vendor exited with code: ${exitCode}`);
                cb();
            });
        })
        .catch((err) => {
            console.error('getFewRowsOfcsvxls to csv error:', err);
            cb(err);
        });
}
let failReason

function doMongoImport(payload, cb) {
    fsXtra.pathExists(payload.tempCSVFilePath)
        .then((isExists) => {
            console.log('inside doMongoImport isExists', isExists)
            let command = ``;
            const dbName = process.env.DB_NAME; // TODO GET ALL VARS FROM ENV VARS
            const dbUser = process.env.DB_USER; // TODO GET ALL VARS FROM ENV VARS
            const dbPass = process.env.DB_PASSWORD; // TODO GET ALL VARS FROM ENV VARS
            if (isExists) {
                if (dbName && payload.collectionName && payload.tempCSVFilePath) {
                    if (process.env.NODE_ENV_LABEL === "MARK_PROD" && dbUser && dbPass) {
                        command += `mongoimport --host ${process.env.DB_URL}  --port ${process.env.DB_PORT} --numInsertionWorkers 2 --db ${dbName} --username ${dbUser} --password ${dbPass} --collection='${payload.collectionName}s' --file=${payload.tempCSVFilePath} --type=csv --drop --columnsHaveTypes --fields="customerId.string()","vendorId.string()","vendorName.string()","vendorAddress.string()"`
                    } else if (dbUser && dbPass) {
                        command += `mongoimport --numInsertionWorkers 2 --db ${dbName} --username ${dbUser} --password ${dbPass} --collection='${payload.collectionName}s' --file=${payload.tempCSVFilePath} --type=csv --drop --columnsHaveTypes --fields="customerId.string()","vendorId.string()","vendorName.string()","vendorAddress.string()"`
                    } else {
                        command += `mongoimport --numInsertionWorkers 2 --db ${dbName} --collection='${payload.collectionName}s' --file=${payload.tempCSVFilePath} --type=csv --drop --columnsHaveTypes --fields="customerId.string()","vendorId.string()","vendorName.string()","vendorAddress.string()"`
                    }
                } else {
                    failReason = `${failReason} dbName,collectionName,tempCSVFilePath are required`
                    return cb("dbName,collectionName,tempCSVFilePath are required")
                }
            }
            console.log("insert command", command)
            const child = spawn(command, {
                shell: true,
            });

            child.stderr.on('data', (data) => {
                console.error('STDERR m:', data.toString());
            });
            child.stdout.on('data', (data) => {
                console.log('STDOUT:', data.toString());
            });
            child.on('exit', (exitCode) => {
                console.log(`doMongoImport bol vendor Child vendor exited with code: ${exitCode}`);
                cb();
            });
        })
        .catch((err) => {
            console.error('MONGO IMPORT bol vendor ERROR:', err);
            cb(err);
        });
}

const uploadNewBolVendorsViaImport = (user, payload, callback) => {
    if (vendorInProgress) {
        return callback({
            ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
            message: "File ALREADY IN PROGRESS"
        })
    }
    vendorInProgress = true
    failReason = ''
    // console.log("inside upload new vendors", user.tenantId, payload);
    // let lastEntryDate = null
    const starttimer = new Date().getTime()
    const name = payload.file.hapi.filename;
    if (name && name.length) {
        const fileExt = name.split('.').pop().toLowerCase();
        if (fileExt !== 'xlsx' && fileExt !== 'csv') {
            return callback(APP_CONSTANTS_STATUS_MSG.ERROR.FILE_UPLOAD.EXT_NOT_ALLOWED);
        }
    }
    let collectionName = "bol_vendor"
    let resultInJson = {}
    let numberOfColumns = 0
    const filename = `bolVendorListLatest.xlsx`;
    const tempfile = 'tempBolVendorList.xlsx'
    const tempCSVfile = 'tempBolVendorList.csv'
    const filePath = `${_pathToDownloads}/${filename}`;
    const tempFilePath = `${_pathToDownloads}/${tempfile}`;
    const tempCSVFilePath = `${_pathToDownloads}/${tempCSVfile}`;
    const minTempCSVFilePath = `${_pathToDownloads}/min_${tempCSVfile}`;
    let callbackCalled = false
    // callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT });
    let startTime
    auto({
        uploadFile: (cb) => {
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    fileUploader(payload.file, tempFilePath, (err, resultObj) => {
                        if (err) {
                            console.error("file uploader err: ", err);
                            cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                        } else {
                            console.log("File Upload Result:", resultObj);
                            cb();
                        }
                    })
                })
                .catch(err => {
                    console.error("Directory ensure err: ", err);
                    cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                });
        },
        convertToCSV: ['uploadFile', (res, cb) => {
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    const payload = {
                        tempFilePath,
                        tempCSVFilePath
                    }
                    convertXLSToCSV(payload, cb)
                })
                .catch(err => {
                    console.error("Directory ensure err: ", err);
                    cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                });
        }],
        convertToMinCSV: ['convertToCSV', (res, cb) => {
            console.log('convertToMinCSV')
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    const payload = {
                        tempCSVFilePath,
                        minTempCSVFilePath
                    }
                    getFewRowsOfcsv(payload, cb)
                })
                .catch(err => {
                    console.error("Directory ensure err: ", err);
                    cb(APP_CONSTANTS_STATUS_MSG.ERROR.IMP_ERROR);
                });
        }],
        readCsv: ['convertToMinCSV', (res, cb) => {
            console.log('readCsv')
            CSV({ noheader: true, headers: ["customerId", "vendorId", "vendorName", "vendorAddress"] })
                .fromFile(minTempCSVFilePath)
                .then((jsonObj) => {
                    console.log("jsonObj", numberOfColumns, jsonObj);
                    if (jsonObj && jsonObj.length) {
                        numberOfColumns = Object.keys(jsonObj[0]).length
                        resultInJson = { Sheet1: jsonObj }
                    } else {
                        resultInJson = null
                    }
                    cb()
                })
        }],
        checkCSVFile: ['readCsv', (res, cb) => {
            // return cb()
            // TODO READ 1ST LINE OF CSV FILE AND CHECK IF VALUES ARE CORRECT, FIX 1ST ROW ALSO
            console.log("resultInJsonL", resultInJson)
            if (!resultInJson || (resultInJson && resultInJson["Sheet1"] && !resultInJson["Sheet1"].length)) {
                console.log("no resultInJson in file")
                return cb({
                    ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                    message: "Invalid File"
                })
            }
            if (resultInJson && (!resultInJson.Sheet1[0].customerId)) {
                return cb({
                    ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                    message: "Missing Columns in File"
                })
            }

            if (resultInJson && (numberOfColumns < 4 || numberOfColumns > 4)) {
                return cb({
                    ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                    message: "Bad Columns in File"
                })
            }
            cb()
            callbackCalled = true
            callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                message: "File is uploaded. Please wait for 5-10 mins depending on file size before changes are reflected"
            })
        }],
        backupOldVendorFile: ['checkCSVFile', (res, cb) => {
            // return cb()
            console.log('backupOldVendorFile')
            const date = moment().tz("Asia/Kolkata").format('YYYY-MM-DD HH:mm:ss').replace(" ", "")
            fsXtra.ensureDir(_pathToDownloads)
                .then(() => {
                    fsXtra.pathExists(filePath)
                        .then((isExists) => {
                            let command = ``
                            if (isExists) {
                                command += `mv ${filePath} ${_pathToDownloads}/vendorListBackup${date}.xlsx`
                            }
                            if (command.length) {
                                command += ` && mv ${tempFilePath} ${filePath}`
                            } else {
                                command += `mv ${tempFilePath} ${filePath}`
                            }
                            const child = spawn(command, {
                                shell: true,
                            });

                            child.stderr.on('data', (data) => {
                                console.error('STDERR:', data.toString());
                            });
                            child.stdout.on('data', (data) => {
                                console.log('STDOUT:', data.toString());
                            });
                            child.on('exit', (exitCode) => {
                                console.log(`backupOldVendorFile Child vendor exited with code: ${exitCode}`);
                                cb();
                            });
                        })
                        .catch((err) => {
                            console.error('key generation error:', err);
                            cb(err);
                        });
                })
                .catch((err) => {
                    console.error('backupOldVendorFile Path ensure error:', err);
                    cb(err);
                });
        }],
        setCollectionName: ['backupOldVendorFile', (_, cb) => {
            console.log('setCollectionName')
            bolVendorsService.currentVendorInuse((e, r) => {
                if (e) {
                    return cb(e);
                }
                const collection = r && r.toLowerCase()
                if (collection === "bol_vendor") {
                    collectionName = "bol_vendor_list"
                }
                cb()
            })
        }],
        doMongoImport: ["setCollectionName", (res, cb) => {
            console.log('doMongoImport')
            startTime = new Date()
            // return cb()
            const payload = {
                tempFilePath,
                tempCSVFilePath,
                collectionName
            }
            doMongoImport(payload, cb)
        }],
        updateVendor: ['doMongoImport', (_, cb) => {
            console.log('updateVendor')
            bolVendorsService.updateOneByCollectionName(collectionName, { "vendorId": "NO_VENDOR", "vendorName": "NO_VENDOR_2", "vendorAddress": "NO_VENDOR_3" },
                { $set: { "vendorId": "NO_VENDOR", "vendorName": "NO_VENDOR", "vendorAddress": "NO_VENDOR" } }, {}, () => {
                    bolVendorsService.updateAllByCollectionName(collectionName, {},
                        { $set: { createdAt: new Date(), updatedAt: new Date() } },
                        {
                            timestamps: false,
                            strict: false
                        }, cb)
                })
        }],
        syncIndexes: ['updateVendor', (_, cb) => {
            // return cb()
            console.log('syncIndexes')
            bolVendorsService.syncIndex(collectionName, cb);
        }],
        changeCurrentCollection: ['syncIndexes', (_, cb) => {
            console.log('changeCurrentCollection')
            bolVendorsService.findOneByCollectionName(collectionName, {}, {}, {}, (e, r) => {
                if (!r) {
                    failReason = `${failReason}
                    Can't point to new db collection ${collectionName}. As no document in collection`
                    return cb(failReason)
                }
                bolVendorsService.changeCurrentCollection(collectionName, (e, r) => {
                    console.log("current collection changed", e, r);
                    cb(e, r)
                })
            })
        }]
    },
        (err) => {
            console.log('in final callback')
            const replacementTimeTaken = startTime && new Date() - startTime
            const mailObj = {};
            vendorInProgress = false
            if (err) {
                failReason = `${failReason}<br> error: ${err.message}`
                const endTime = new Date().getTime()
                mailObj["subject"] = `Upload bol Vendor failed`
                mailObj["body"] = `Something went wrong while uploading bol vendor. Uploaded by ${user.email} Total time taken: ${endTime - starttimer}ms <br> failReason: ${failReason}`
                console.error("VENDOR UPLOAD FAILED", err.message)
                if (!callbackCalled) {
                    callback(err)
                }
            } else {
                const endTime = new Date().getTime()
                mailObj["subject"] = `Upload Bol Vendor Success`
                mailObj["body"] = `Successfully uploaded new bol vendors file. Uploaded by ${user.email} Total request time taken: ${endTime - starttimer}ms.
                Total time to replace vendor list ${replacementTimeTaken}`
            }
            sendEmail({
                subject: mailObj.subject,
                body: mailObj.body,
                apiTarget: 'DEV_TESTING'
            }).then(() => { }).catch((e) => { console.error("Error while sending mail::", e); });
            // callback(null, {
            //     ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            //     message: "File is uploaded. Please wait for 5-10 mins depending on file size before changes are reflected"
            // })
        })
}

module.exports = {
    fetchBolVendors,
    bolVendorDetail,
    createBolVendor,
    updateBolVendor,
    deleteBolVendor,
    uploadNewBolVendors,
    fetchAllBolCustomers,
    uploadNewBolVendorsViaImport
}
