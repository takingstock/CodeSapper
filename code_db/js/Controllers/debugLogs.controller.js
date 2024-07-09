const config = require('config');
const async = require("async");
const { auto } = require('async');
const moment = require('moment-timezone');
const fs = require('fs');
const fsPromise = require('fs').promises;
const json2xlsAsync = require('p3x-json2xls-worker-thread');
const fsXtra = require('fs-extra');
const Axios = require("axios");
const FormData = require("form-data");
const { userService, debugLogsService, roleService, documentService, idpService } = require('../Services');

const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');

const FINAL_REPORT_DIR = config.get('REPORTS_FOLDER.PATH');
const AMYGB_INFRA = config.get('AMYGB_INFRA');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const {
    createMongooseId,
} = require('../Utils/universal-functions.util');

const saveLogsInDb = (payload, callback) => {
    // console.log("payload---->", payload)
    let createdByFromPayload = null
    if (payload && payload.data && payload.data.hasOwnProperty('createdBy')) {
        createdByFromPayload = payload.data.createdBy;
        delete payload.data.createdBy;
    }
    // console.log("Updated payload", payload)
    const body = {
        payloadObject: payload,
        batchId: payload && payload.data && payload.data.idpId,
        from: payload.from,
        ipAddress: payload && payload.data && payload.data.ip,
        createdBy: createdByFromPayload,
        externalBatchId: payload && payload.data && payload.data.externalBatchId
    };
    // console.log("BODY FOR SAVE LOGS", body);
    auto({
        fetchDocument: (cb) => {
            if (body.batchId) {
                return cb()
            }
            if (payload && payload.data && payload.data.documentId) {
                documentService.findOne({ _id: payload.data.documentId }, { idpId: 1 }, null, null, (err, doc) => {
                    if (err) {
                        return cb(err)
                    }
                    body.batchId = doc.idpId
                    cb()
                })
            } else {
                console.log("failed to fetch batch id on payload---->", payload)
                cb()
            }
        },
        fetchBatch: ['fetchDocument', (res, cb) => {
            if (body.batchId) {
                idpService.findOne({ _id: body.batchId }, { name: 1, tenantId: 1 }, null, null, (err, batch) => {
                    if (err) {
                        return cb(err)
                    }
                    body['batchNumber'] = batch.name
                    body['tenantId'] = createMongooseId(batch.tenantId)
                    // console.log("BODY IN fetchBatch", body)
                    cb()
                })
            } else {
                console.log("failed to fetch  batch name---->", payload)
                cb()
            }
        }],
        saveLog: ['fetchBatch', (_, cb) => {
            //console.log("Body for SAVE LOGS IN DB", body)
            debugLogsService.create(body, (err, response) => {
                if (err) {
                    console.error("Err while saving logs in Db ==>", err);
                    return cb(err)
                }
                console.log("RESPONSE AFTER BEING SAVED IN DB", response.from);
                cb(null, response)
            })
        }]
    }, (err, { saveLog }) => {
        if (err) {
            console.error("Err while saving logs in Db ==>", err);
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES, data: saveLog })
    })
}

const fetchLogs = ({ id }, payload, callback) => {
    const criteria = {
        isDeleted: false,
    }
    const { limit = 10, offset = 0 } = payload
    criteria['_id'] = createMongooseId(id)
    console.log("CRITERIA ==>", criteria)
    console.log("payload ==>", payload)
    auto({
        fetchLogs: (cb) => {
            console.log("fetchLogs")
            const criteria = {
            }
            if (payload.batchId) {
                criteria['batchId'] = payload.batchId
            }
            if (payload.batchNumber) {
                criteria['batchNumber'] = payload.batchNumber
            }
            if (payload.tenantId) {
                criteria['tenantId'] = createMongooseId(payload.tenantId)
            }
            if (payload.ipAddress) {
                criteria['ipAddress'] = payload.ipAddress
            }
            debugLogsService.findAll(criteria, {}, { offset, limit }, (err, result) => {
                if (err) {
                    return cb(err);
                }
                return cb(null, result)
            });
        }
    }, (err, { fetchLogs }) => {
        if (err) {
            console.log(err);
            return callback(err);
        }

        return callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: fetchLogs });
    })
}

const fetchLogsReport = ({ id }, payload, callback) => {
    const criteria = {
        isDeleted: false,
        // tenantId: createMongooseId(tenantId)
    }
    let resultFromDb = []
    let formattedDataArray = []
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    criteria['_id'] = createMongooseId(id)
    // console.log("CRITERIA ==>", criteria)
    auto({
        fetchLogs: (cb) => {
            console.log("fetchLogs++++++")
            const criteria = {
                createdAt: {
                    $gte: moment.tz(payload.startDate, "DD-MM-YYYY", "America/Chicago").startOf('day').toISOString(),
                    $lte: moment.tz(payload.endDate, "DD-MM-YYYY", "America/Chicago").endOf('day').toISOString()
                },
                from: payload.from
            }
            console.log("CRITERIA FOR FETCHING", criteria)
            debugLogsService.findAll(criteria, {}, {}, (err, result) => {
                if (err) {
                    return cb(err);
                }
                resultFromDb = result
                console.log("resultFromDb==>", resultFromDb.length)
                cb(null, result)
            });
        },
        formatData: ['fetchLogs', (res, cb) => {
            let formattedDataObj = {};
            let srNo = 1
            if (!resultFromDb.length) {
                return cb()
            }
            for (const resultObj of resultFromDb) {
                formattedDataObj['Sr No'] = srNo
                // console.log("SNo", srNo)
                if (srNo === 30) {
                    console.log("Sr No", resultObj)
                }
                formattedDataObj['From'] = resultObj.from
                formattedDataObj['Payload'] = resultObj.payloadObject && resultObj.payloadObject.data ? resultObj.payloadObject.data : {}
                formattedDataObj['createdAt'] = moment(resultObj.createdAt).tz("America/Chicago").format("DD-MM-YYYY HH:mm::ss")

                formattedDataArray.push(formattedDataObj);
                formattedDataObj = {}
                srNo++
            }
            // console.log("formattedDataArray", formattedDataArray[28], formattedDataArray[29], formattedDataArray[30])
            cb(null, formattedDataArray)
        }],
        splitData: ['formatData', (res, cb) => {
            if (!payload.sendResponseAsJson) {
                if (formattedDataArray.length === 0) return cb();
                const perChunk = 50000;
                formattedDataArray = formattedDataArray.reduce((resultArray, item, index) => {
                    const chunkIndex = Math.floor(index / perChunk);
                    if (!resultArray[chunkIndex]) {
                        resultArray[chunkIndex] = []; // start a new chunk
                    }
                    resultArray[chunkIndex].push(item);
                    return resultArray;
                }, []);
                console.log("TOTAL CHUNKS OF DOC LIFECYCLE REPORT:", formattedDataArray.length);
            }
            cb();
        }],
        createXls: ['splitData', (res, cb) => {
            // return cb()
            if (formattedDataArray && formattedDataArray.length) {
                console.log("INSIDE CREATE XLS formattedDataArray:", formattedDataArray.length)
                async.forEachOf(formattedDataArray, async (formatData, key) => {
                    // console.log("SUBARRAY LENGTH:", formatData.length, "KEY:", key);
                    try {
                        const options = {
                            output: 'binary',
                            nodeExcel: {}
                        };
                        console.log("before json2xlsAsync")
                        const xlsBinary = await json2xlsAsync(formatData, options);
                        const fileName = `LOGS_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;
                        console.log("before ensureDir")

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        console.log("before writeFile")

                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR LOGS_REPORT:", filePath);
                        reportsDownloadLinksArray.push(fileName)
                        filePathArray.push({
                            filePath,
                            key: key + 1
                        });

                        return;
                    } catch (err) {
                        console.error("XLS creation error", err);
                        return err;
                    }
                }, cb);
            } else {
                cb()
            }
        }],
        sendFileToServer: ['createXls', (res, cb) => {
            // return cb()
            // if (!payload.sendResponseAsJson) {
            console.log("filePathArray.length", filePathArray.length)
            if (filePathArray.length === 0) return cb();

            async.each(filePathArray, (obj, icb) => {
                const data = new FormData();

                data.append('files', fs.createReadStream(obj.filePath));

                const config = {
                    method: 'post',
                    url: `${AMYGB_INFRA.STORAGE_SERVER}/storeOriginal`,
                    headers: {
                        ...data.getHeaders()
                    },
                    data,
                    'maxContentLength': Infinity,
                    'maxBodyLength': Infinity
                };

                Axios(config)
                    .then(response => {
                        obj.fileServerData = response.data || null;
                        icb();
                    })
                    .catch(err => {
                        console.error("sendFileToServer err:", err);
                        icb();
                    })
            }, cb);
            // } else {
            //     cb()
            // }
        }],

        sendEmail: ['sendFileToServer', (res, cb) => {
            // return cb()
            // if (!payload.sendResponseAsJson) {
            const dataToSend = {
                subject: `Logs Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                html: '',
            };

            let reportLinkString = "";
            if (filePathArray.length === 0) {
                dataToSend.html = "No Data Found to create report"
            } else {
                filePathArray.sort((a, b) => a.key - b.key);

                let i = 0;

                for (const obj of filePathArray) {
                    i += 1;
                    const newFileName = (obj.fileServerData
                        && obj.fileServerData.validFileObjWithPath
                        && obj.fileServerData.validFileObjWithPath.filePath
                        && obj.fileServerData.validFileObjWithPath.filePath.split('/').pop())
                        || "";
                    console.log("NEW FILE NAME", newFileName);
                    if (newFileName) {
                        reportLinkString += `${i.toString()}. https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}<br><br>`;
                        reportsLinksArray.push(`https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}`)
                    }
                }
                dataToSend.html = `Please find the report in the links below: <br>${reportLinkString}`;
            }
            // if (payload.sendCombinedMail) {
            //     if (reportLinkString) {
            //         return cb(null, reportLinkString)
            //     }
            //     return cb(null, "No Data Found to create report - Logs report")
            // }
            ImcAPIEndPoints.sendEmail({
                subject: dataToSend.subject,
                body: dataToSend.html,
                apiTarget: 'LOGS'
            }).then(() => { cb() }).catch((e) => { cb(e) });
            // } else {
            //     cb()
            // }
        }],
    }, (err) => {
        if (err) {
            console.log(err);
            return callback(err);
        }
        console.log("DONE++++++++>")

        return callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: formattedDataArray });
    })
}

module.exports = {
    fetchLogs,
    saveLogsInDb,
    fetchLogsReport
}
