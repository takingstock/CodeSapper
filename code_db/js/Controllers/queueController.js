const config = require('config');
const async = require("async");
const moment = require('moment-timezone');
const fs = require('fs');

const fsPromise = fs.promises;
const json2xlsAsync = require('p3x-json2xls-worker-thread');
const fsXtra = require('fs-extra');
const Axios = require("axios");
const FormData = require("form-data");
const { userService, queueLogsService, roleService, documentService, tenantService } = require('../Services');
const { statistics } = require('./admin-dashboard.controller');
const { getServerStatus, serverStatus } = require('../Utils/load-balancer')
const { indexerFiles } = require('./idp.controller')
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const { upscaleServerCheck } = require("./admin-dashboard.controller")

const FINAL_REPORT_DIR = config.get('REPORTS_FOLDER.PATH');
const AMYGB_INFRA = config.get('AMYGB_INFRA');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
let alertSendAt = null;
let internalAlertSendAt = null;
const {
    createMongooseId,
} = require('../Utils/universal-functions.util');

const createQueueLogs = (dateData, callback) => {
    console.log("ENTER createQueueLogs====>")
    const date = new Date(new Date().getTime() - 1000 * 60)
    let tenantId = null;
    const jsonToSave = {
        totalServer: 0,
        busy: 0,
        free: 0,
        mainQueue: 0,
        reClassficationQueue: 0,
        totalOcrResponses: 0,
        totalReclassificationResponses: 0,
        reClassficationInProgress: 0,
        reClassficationPending: 0,
        reClassficationCompleted: 0
    }
    async.auto({
        fetchDataFromStatistics: (cb) => {
            statistics({}, (err, result) => {
                if (err) {
                    return cb(err);
                }
                const mainQueue = result && result.data && result.data.documentsaiStatus
                if (mainQueue) {
                    jsonToSave.mainQueue = ((mainQueue.OCR_PENDING && mainQueue.OCR_PENDING.total) || 0) + ((mainQueue.OCR_RETRY && mainQueue.OCR_RETRY.total) || 0)
                }
                const classify = result && result.data && result.data.documentClassificationStatus
                if (classify) {
                    jsonToSave.reClassficationQueue = ((classify.STARTED && classify.STARTED.total) || 0) + ((classify.RETRY && classify.RETRY.total) || 0)
                }
                // console.log("JSON to save", jsonToSave);
                cb(null, result);
            })
        },
        fetchTenant: (cb) => {
            const criteria = { name: "sowmya" }
            if (process.env.NODE_ENV_LABEL === "MARK_PROD") {
                criteria.name = "mark_buckley"
            }
            tenantService.findOne(criteria, {}, {}, (e, r) => {
                if (e) {
                    return cb(e)
                }
                tenantId = r && r._id
                cb()
            })
        },
        fetchOcrResponseCount: (cb) => {
            documentService.fetchDistinct("fileName", { ocrResponseTime: { $gte: date } }, (e, r) => {
                if (e) {
                    return cb(e)
                }
                jsonToSave.totalOcrResponses = (r && r.length) || 0
                cb()
            })
        },
        fetchClassificationResponseCount: (cb) => {
            documentService.fetchDistinct("fileName", { keyExtractResponseTime: { $gte: date } }, (e, r) => {
                if (e) {
                    return cb(e)
                }
                jsonToSave.totalReclassificationResponses = (r && r.length) || 0
                cb()
            })
        },
        indexerFiles: ['fetchTenant', (_, cb) => {
            indexerFiles({ tenantId, customers: null }, { queueController: true }, (e, r) => {
                if (e) {
                    return cb(e)
                }
                // console.log("indexer response: ", r)
                const {
                    reviewPendingCount = 0,
                    classificationReviewedCount = 0 } = r.data
                // jsonToSave.reClassficationInProgress = (r && r.length) || 0
                jsonToSave.reClassficationPending = reviewPendingCount
                jsonToSave.reClassficationCompleted = classificationReviewedCount
                cb()
            })
        }],
        fetchReClassficationInProgressCount: ['fetchTenant', (res, cb) => {
            documentService.fetchDistinct("ocrClassification", { ocrClassification: { $in: ['IN_PROGRESS', 'WITHOUT_OCR_IN_PROGRESS'] } }, (e, r) => {
                if (e) {
                    return cb(e)
                }
                jsonToSave.reClassficationInProgress = (r && r.length) || 0
                cb()
            })
        }],
        // fetchReClassficationPendingCount: ['fetchTenant', (res, cb) => {
        //     documentService.fetchDistinct("ocrClassification", { ocrClassification: { $in: ['PENDING', 'RETRY'] }, tenantId }, (e, r) => {
        //         if (e) {
        //             return cb(e)
        //         }
        //         jsonToSave.reClassficationPending = (r && r.length) || 0
        //         cb()
        //     })
        // }],
        // fetchReClassficationCompletedCount: ['fetchTenant', (res, cb) => {
        //     documentService.fetchDistinct("ocrClassification", { ocrClassification: 'COMPLETED', tenantId }, (e, r) => {
        //         if (e) {
        //             return cb(e)
        //         }
        //         jsonToSave.reClassficationCompleted = (r && r.length) || 0
        //         cb()
        //     })
        // }],
        fetchServerStatus: (cb) => {
            const serverStatus = getServerStatus()
            jsonToSave.totalServer = Object.keys(serverStatus.finalStats).length;
            // console.log("serverStatus -->", JSON.stringify(serverStatus))
            if (serverStatus.serverSummary.hasOwnProperty('FREE')) {
                jsonToSave.free = serverStatus.serverSummary.FREE
            } else {
                jsonToSave.free = 0
            }
            if (serverStatus.serverSummary.hasOwnProperty('BUSY')) {
                jsonToSave.busy = serverStatus.serverSummary.BUSY
            } else {
                jsonToSave.busy = 0
            }
            cb()
        },
        saveJsonInDb: ['fetchReClassficationInProgressCount', 'indexerFiles', 'fetchDataFromStatistics', 'fetchServerStatus', (res, cb) => {
            // return cb()
            jsonToSave.cpuUtilization = Object.values(serverStatus).filter(e => e.sshUP).map(e => (`${[e.ip]}: ${e.cpu}`)).join("\n")
            // console.log("jsonToSave for SAVE LOGS IN DB", jsonToSave)
            queueLogsService.create(jsonToSave, (err, response) => {
                if (err) {
                    console.error("Err while saving Queue logs in Db ==>", err);
                    return cb(err)
                }
                // console.log("RESPONSE AFTER BEING SAVED IN DB", response.from);
                cb(null, response)
            })
        }]

    }, (err) => {
        if (err) {
            console.error("Err while saving queue logs in Db ==>", err);
        }
        if (jsonToSave.mainQueue >= 100) {
            let sendAlert = true
            if (alertSendAt) {
                const timeDiff = new Date().getTime() - alertSendAt
                sendAlert = timeDiff >= (1000 * 60 * 10)
            }
            if (sendAlert) {
                alertSendAt = new Date().getTime()
                let apiTarget = "OCR"
                if (process.env.NODE_ENV_LABEL === "MARK_PROD") {
                    apiTarget = "QUEUE_SIZE_ALERT2"
                }
                ImcAPIEndPoints.sendEmail({
                    subject: `Queue size > 100`,
                    apiTarget,
                    body: `OCR Queue size is ${jsonToSave.mainQueue}.`,
                }).then(() => { }).catch(() => { })
            }
        } else if (jsonToSave.mainQueue >= 80) {
            let sendAlert = true
            if (internalAlertSendAt) {
                const timeDiff = new Date().getTime() - internalAlertSendAt
                sendAlert = timeDiff >= (1000 * 60 * 10)
            }
            if (sendAlert) {
                internalAlertSendAt = new Date().getTime()
                const emails = `requordit_support@amygb.ai`
                ImcAPIEndPoints.sendEmail({
                    emails,
                    subject: `Queue size > 80`,
                    apiTarget: "QUEUE_SIZE_ALERT",
                    body: `OCR Queue size is ${jsonToSave.mainQueue}.`,
                }).then(() => { }).catch(() => { })
            }
        }
        // jsonToSave.reClassficationQueue
        if (process.env.AUTO_SCHEDULAR_AI_SERVERS === "ENABLED") {
            upscaleServerCheck({ filesCount: jsonToSave.mainQueue, ...dateData })
        }
        callback(null, "Success")
    })
}

const fetchQueueLogs = ({ id }, payload, callback) => {
    const { sortBy = 'createdAt', orderBy = 'DESC', offset = 0, limit = 50 } = payload
    const sortObj = {
        [`${sortBy}`]: orderBy === 'DESC' ? -1 : 1,
    };
    console.log("payload: ", JSON.stringify(payload))
    async.auto({
        fetchQueueLogs: (cb) => {
            // console.log("fetch QUEUE Logs", payload)
            let projection = {}
            if (payload.count !== 'ALL') {
                projection = payload.count
            }
            queueLogsService.findAll({}, projection, { offset, limit, sort: sortObj }, (err, result) => {
                if (err) {
                    return cb(err);
                }
                // console.log("fetch QUEUE Logs++++++++>>>>", result)
                return cb(null, result)
            });
        }
    }, (err, { fetchQueueLogs }) => {
        if (err) {
            console.log(err);
            return callback(err);
        }

        return callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: fetchQueueLogs });
    })
}
const queueLogsReport = ({ id }, payload, callback) => {
    // const criteria = {
    //     isDeleted: false,
    //     // tenantId: createMongooseId(tenantId)
    // }
    let resultFromDb = []
    let roleId = null;
    let reportLinkString = "";
    let formattedDataArray = []
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    // criteria['_id'] = createMongooseId(id)
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", "America/Chicago")
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", "America/Chicago")
    const dateRangeInDays = date2.diff(date1, "days");
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    // console.log("CRITERIA ==>", criteria)
    async.auto({
        fetchLogs: (cb) => {
            console.log("fetchLogs++++++")
            const criteria = {
                createdAt: {
                    $gte: moment.tz(payload.startDate, "DD-MM-YYYY", "America/Chicago").startOf('day').toISOString(),
                    $lte: moment.tz(payload.endDate, "DD-MM-YYYY", "America/Chicago").endOf('day').toISOString()
                }
            }
            console.log("CRITERIA FOR FETCHING", criteria)
            queueLogsService.findAll(criteria, {}, { sort: { createdAt: 1 } }, (err, result) => {
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
                formattedDataObj['totalServer'] = resultObj.totalServer
                formattedDataObj['busy'] = resultObj.busy
                formattedDataObj['free'] = resultObj.free
                formattedDataObj['mainQueue'] = resultObj.mainQueue
                formattedDataObj['reClassficationQueue'] = resultObj.reClassficationQueue
                formattedDataObj['totalOcrResponses'] = resultObj.totalOcrResponses
                formattedDataObj['totalReclassificationResponses'] = resultObj.totalReclassificationResponses
                formattedDataObj['reClassficationInProgress'] = resultObj.reClassficationInProgress
                formattedDataObj['reClassficationPending'] = resultObj.reClassficationPending
                formattedDataObj['reClassficationCompleted'] = resultObj.reClassficationCompleted
                formattedDataObj['createdAt'] = moment(resultObj.createdAt).tz("America/Chicago").format("DD-MM-YYYY HH:mm:ss")
                formattedDataObj['CPU Utilizations'] = resultObj.cpuUtilization
                formattedDataObj[`server_1`] = ''
                formattedDataObj[`server_2`] = ''
                formattedDataObj[`server_3`] = ''
                formattedDataObj[`server_4`] = ''
                formattedDataObj[`server_5`] = ''
                const servers = resultObj.cpuUtilization && resultObj.cpuUtilization.split("\n")
                if (servers && servers.length) {
                    servers.forEach((s, i) => {
                        const v = s.split(":")[1].trim()
                        if (v && v !== "undefined") {
                            formattedDataObj[`server_${(i + 1)}`] = (s.split(":")[1]) || ''
                        }
                    })
                }
                formattedDataArray.push(formattedDataObj);
                if (srNo === 425) {
                    console.log(formattedDataObj)
                }
                srNo++

                formattedDataObj = {}
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

                        const xlsBinary = await json2xlsAsync(formatData, options);
                        const fileName = `QUEUE_LOGS_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR LOGS_REPORT:", filePath);
                        reportsDownloadLinksArray.push(fileName)
                        filePathArray.push({
                            filePath,
                            key: key + 1
                        });

                        return
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
                subject: `Queue Logs Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                html: '',
            };

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
            if (payload.sendCombinedMail) {
                return cb()
            }
            ImcAPIEndPoints.sendEmail({
                subject: dataToSend.subject,
                body: dataToSend.html,
                apiTarget: 'QUEUE_LOGS'
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
        return callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: reportLinkString });
    })
}
let responseAlert = null
const checkLastTenFilesAvgTime = (callback) => {
    // const timeStamp = new Date().getTime() - (1000 * 60 * 60 * 24 * 2)
    const timeStamp = new Date().getTime() - (1000 * 60 * 60 * 2); // last 2 hours only
    const timeDiff = new Date().getTime() - responseAlert

    if (timeDiff >= (1000 * 60 * 30)) {
        // check a for ocr response
    } else {
        // skip as alert recently send
        return callback()
    }
    async.auto({
        files: (cb) => {
            const match = { $match: { aiStatus: "OCR_COMPLETE", ocrRequestTime: { $gte: new Date(timeStamp) } } } // criteria added as per index
            const group = {
                $group: {
                    _id: "$fileName",
                    ocrResponseInSec: {
                        $sum: {
                            $dateDiff: {
                                startDate: "$ocrRequestTime",
                                endDate: "$ocrResponseTime",
                                unit: "second"
                            }
                        }
                    },
                    totalPages: { $sum: "$docTotalPages" },
                }
            }
            const sort = { $sort: { "file.ocrResponseTime": -1 } }
            const limit = { $limit: 10 }
            const stages = [match, group, sort, limit] // pcis
            // console.log("STAGES:", stages)
            documentService.aggregation(stages, cb)
        },
        checkAveragProcessingTime: ['files', ({ files }, cb) => {
            let totalPages = 0
            let ocrResponseInSec = 0
            let filesCount = 0
            files.forEach(f => {
                filesCount += 1
                totalPages += f.totalPages;
                ocrResponseInSec += f.ocrResponseInSec
            })
            console.log("filesCount: ", filesCount)
            console.log("totalpages: ", totalPages)
            console.log("ocrResponseInSec: ", ocrResponseInSec)
            const averageResponseTime = (ocrResponseInSec / totalPages) || 0
            console.log("averageResponseTime: ", averageResponseTime)
            if (averageResponseTime > 45) {
                // todo send Alerts
                let emails = `auqib@amygb.ai,shahab@amygb.ai`
                if (process.env.NODE_ENV_LABEL === "MARK_PROD") {
                    //emails = `requordit_support@amygb.ai`
                }
                responseAlert = new Date()
                ImcAPIEndPoints.sendEmail({
                    subject: "Average response > 45 secs",
                    emails,
                    body: `Average response time for last ${filesCount} files pages:${totalPages},responsetime:${ocrResponseInSec}, average:${averageResponseTime}`,
                    apiTarget: 'QUEUE_SIZE_ALERT'
                }).then(() => { }).catch((e) => { });
            }
            cb()
        }]
    }, (e, { files }) => {
        // console.log("gggggggggggggggggggggggggg", files)
        callback()
    })
}
module.exports = {
    fetchQueueLogs,
    queueLogsReport,
    createQueueLogs,
    checkLastTenFilesAvgTime,
}
