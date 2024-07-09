const config = require('config');
const async = require("async");
const moment = require('moment-timezone');
const fs = require('fs');
const fsPromise = require('fs').promises;
const json2xlsAsync = require('p3x-json2xls-worker-thread');
const fsXtra = require('fs-extra');
const Axios = require("axios");
const FormData = require("form-data");
const { documentService, roleService, customersService, userService, tenantService, reportsListService } = require('../Services');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const { createMongooseId, getDateRangeBetweenTwoDates } = require('../Utils/universal-functions.util');
const { queueLogsReport } = require("./queueController");
const IDP_BACKUP = require('../Models/idp-documentlist-backup.model');
const PAGE = require('../Models/page.model');

const FINAL_REPORT_DIR = config.get('REPORTS_FOLDER.PATH');

const AMYGB_INFRA = config.get('AMYGB_INFRA');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const TIME_ZONE = process.env.TIME_ZONE || 'America/Chicago'

const getDocLifecycleReport = ({ id, name, email, tenantId }, payload, callback) => {
    console.log("payloadddd getDocLifecycleReport::::", payload)
    console.log("reports tenantId ::::", tenantId)
    let documentsArray = [];
    const users = {};
    const roles = {};
    const customersTeam = {};
    let formattedDataArray = [];
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    let reportId = null
    let userName = name
    // console.log("userName:", userName)
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE)
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE)
    const dateRangeInDays = date2.diff(date1, "days");
    const { tenantName = "mark_buckley" } = payload
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    async.auto({
        getUserName: (cb) => {
            if (!name) {
                userService.findOne({ _id: id }, { firstName: 1 }, { lean: true }, null, (err, res) => {
                    if (err) {
                        console.error("userService err:", err)
                        return cb(err)
                    }
                    if (res) {
                        userName = res.firstName
                    }
                    cb()
                })
            } else {
                cb()
            }
        },
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name: tenantName }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = res._id
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                cb()
            }
        },
        insertIntoReportList: ["getUserName", (res, cb) => {
            const dataToInsert = {
                createdByUser: userName || email,
                reportName: `DOC_LIFECYCLE_REPORT_${payload.startDate}-${payload.endDate}`,
                status: "PENDING",
                tenantId,
                reportType: "DOC_LIFECYCLE",
                isDownloaded: false,
                reportLinks: []
            }
            reportsListService.create(dataToInsert, (err, res) => {
                if (err) {
                    console.error("reportsListService.create err:", err)
                    return cb(err)
                }
                reportId = res._id
                console.log("DOC_LIFECYCLE_REPORT successfully inserted into reportlist")
                cb()
            })
        }],
        getTicketData: ['getTenantId', (_, cb) => {
            const criteria = {
                createdAt: {
                    $gte: moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString(),
                    $lte: moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
                },
                tenantId
            };
            const projection = {
            };
            const option = {
                lean: true,
                $sort: { updatedAt: -1 }
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("result::::", result)
                    documentsArray = result || [];
                    // console.log("documentsArray.length::::", documentsArray.length)
                    cb();
                }
            })
        }],
        findLatestPages: ['getTicketData', (_, cb) => {
            async.eachLimit(documentsArray, 10, (doc, ecb) => {
                if (doc.pageArray && doc.pageArray[0]) {
                    return ecb() // old document
                }
                // new document
                PAGE.find({ documentId: doc._id }).lean().exec((e, pages) => {
                    if (pages && pages[0]) {
                        doc.pageArray = pages
                    }
                    ecb()
                })
            }, cb)
        }],
        getRolesData: ['getTicketData', (res, cb) => {
            roleService.findAll({}, { role: 1 }, {}, (err, result) => {
                if (err) {
                    return cb(err);
                }
                for (const role of result) {
                    roles[role._id] = role.role
                }
                cb()
            });
        }],
        getUsersData: ['getTicketData', (res, cb) => {
            userService.findAll({ tenantId }, { firstName: 1, _id: 1, roleId: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("roleService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("users result:::", result)
                    for (const user of result) {
                        users[user._id] = {
                            "name": user.firstName,
                            "role": user.roleId
                        }
                    }
                    // console.log("users:::", users)
                    cb();
                }
            })
        }],
        getCustomersData: ['getUsersData', (res, cb) => {
            customersService.findAll({ tenantId }, { teamName: 1, customersArray: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("customersService.findAll err:", err);
                    cb(err);
                } else {
                    for (const team of result) {
                        for (const customer in team.customersArray) {
                            if (!(customer in customersTeam)) {
                                customersTeam[customer] = team.teamName
                            }
                        }
                    }
                    // console.log("customerTeam:::", customersTeam)
                    cb();
                }
            })
        }],
        formatData: ['getCustomersData', 'findLatestPages', (res, cb) => {
            if (!documentsArray.length) {
                console.log("no documents found in db")
                return cb();
            }

            const formattedDataObj = {};
            // let docCount = 0
            // let docIfCount = 0
            // let docElseCount = 0
            // let docAidocCount = 0
            for (const documentObj of documentsArray) {
                // docCount += 1
                documentObj.uploadedDocType = documentObj.uploadedDocType || "Invoices Custom"
                if (documentObj && documentObj.fileName) {
                    if (!(formattedDataObj[documentObj.fileName])) {
                        formattedDataObj[documentObj.fileName] = documentObj || {};
                        // before qc page/doc type starts
                        formattedDataObj[documentObj.fileName]["aiInvoiceCount"] = 0;
                        formattedDataObj[documentObj.fileName]["aiSdCount"] = 0;
                        formattedDataObj[documentObj.fileName]["aiInvoiceTotalPages"] = 0;
                        formattedDataObj[documentObj.fileName]["aiSdTotalPages"] = 0
                        formattedDataObj[documentObj.fileName]["aiInvoicesExtractedCount"] = 0
                        formattedDataObj[documentObj.fileName]["aiInvoicesSDNonExtractedCount"] = 0
                        // before qc page/doc type ends
                        // after qc page/doc type starts
                        formattedDataObj[documentObj.fileName]["invoiceCount"] = 0;
                        formattedDataObj[documentObj.fileName]["sdCount"] = 0;
                        formattedDataObj[documentObj.fileName]["invoiceTotalPages"] = 0;
                        formattedDataObj[documentObj.fileName]["sdTotalPages"] = 0
                        formattedDataObj[documentObj.fileName]["invoicesExtractedCount"] = 0
                        formattedDataObj[documentObj.fileName]["invoicesSDNonExtractedCount"] = 0
                        // after qc page/doc type ends
                        formattedDataObj[documentObj.fileName]["totalPages"] = 0
                        formattedDataObj[documentObj.fileName]["ocrUrl"] = documentObj.ocrUrl
                    }
                    documentObj.aiDocType = documentObj.aiDocType || documentObj.docType

                    // docAidocCount += 1
                    if (documentObj.docType !== '#NEW_FORMAT#') {
                        formattedDataObj[documentObj.fileName]["invoiceCount"] += 1;
                    } else {
                        formattedDataObj[documentObj.fileName]["sdCount"] += 1;
                    }
                    if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                        formattedDataObj[documentObj.fileName]["aiInvoiceCount"] += 1;
                    } else {
                        formattedDataObj[documentObj.fileName]["aiSdCount"] += 1;
                    }
                    formattedDataObj[documentObj.fileName]["totalPages"] += (documentObj.pageArray ? documentObj.pageArray.length : 0);
                    if (documentObj.pageArray) {
                        for (const eachPage of documentObj.pageArray) {
                            // console.log("eachPage.page_type::", eachPage.page_type, typeof eachPage.page_type)
                            if (eachPage.page_type === "Invoices Custom") {
                                formattedDataObj[documentObj.fileName]["invoicesExtractedCount"] += 1
                                formattedDataObj[documentObj.fileName]["invoiceTotalPages"] += 1
                            } else {
                                formattedDataObj[documentObj.fileName]["invoicesSDNonExtractedCount"] += 1
                                formattedDataObj[documentObj.fileName]["sdTotalPages"] += 1;
                            }
                            eachPage.ai_page_type = eachPage.ai_page_type || eachPage.page_type
                            if (eachPage.ai_page_type === "Invoices Custom") {
                                formattedDataObj[documentObj.fileName]["aiInvoicesExtractedCount"] += 1
                                formattedDataObj[documentObj.fileName]["aiInvoiceTotalPages"] += 1;
                            } else {
                                formattedDataObj[documentObj.fileName]["aiInvoicesSDNonExtractedCount"] += 1
                                formattedDataObj[documentObj.fileName]["aiSdTotalPages"] += 1;
                            }
                        }
                    }
                }
            }
            let srNo = 0
            // console.log("docCount:::::", docCount)
            // console.log("docIfCount:::::", docIfCount)
            // console.log("docElseCount:::::", docElseCount)
            // console.log("docAidocCount:::::", docAidocCount)
            // console.log("formattedDataObj:::::", formattedDataObj)
            for (const document in formattedDataObj) {
                srNo += 1
                // console.log("reviewedBy:", formattedDataObj[document].reviewedBy)
                // console.log(" name:", users[formattedDataObj[document].reviewedBy].name)
                // console.log("reviewAcceptedBy:", formattedDataObj[document].reviewAcceptedBy)
                // console.log(" name:", users[formattedDataObj[document].reviewAcceptedBy].name)
                let docClassification = "NA"
                if (formattedDataObj[document].classification) {
                    if (formattedDataObj[document].classification === "NOT_REQUIRED") {
                        docClassification = "PENDING"
                    } else {
                        docClassification = formattedDataObj[document].classification
                    }
                }
                const formattedObj = {
                    "Sr No": srNo.toString(),
                    "Customer Id": formattedDataObj[document].externalCustomerId || "NA",
                    "Vendor Id": (formattedDataObj[document].mapping && formattedDataObj[document].mapping["Vendor ID"]) || "NA",
                    "Upload Date": formattedDataObj[document].createdAt ? moment(formattedDataObj[document].createdAt).tz('America/Chicago').format('DD-MM-YYYY') : "NA",
                    "Upload Time": formattedDataObj[document].createdAt ? moment(formattedDataObj[document].createdAt).tz('America/Chicago').format('HH:mm:ss') : "NA",
                    "AI Process Request Time": formattedDataObj[document].ocrRequestTime ? moment(formattedDataObj[document].ocrRequestTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                    "AI Process Response Time": formattedDataObj[document].ocrResponseTime ? moment(formattedDataObj[document].ocrResponseTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                    "External Batch Id": (formattedDataObj[document].external && formattedDataObj[document].external.batchId) || "NA",
                    "Doc Id": (formattedDataObj[document].external && formattedDataObj[document].external.docId) || "NA",
                    "File Name": formattedDataObj[document].fileOriginalName || "NA",
                    "AI Invoice Count": formattedDataObj[document].aiInvoiceCount || "0",
                    "AI Invoice Total Pages Count": formattedDataObj[document].aiInvoiceTotalPages || "0",
                    "AI Invoice Total Extracted Pages Count": formattedDataObj[document].aiInvoicesExtractedCount || "0",
                    "AI Invoice Total Non Extracted Pages Count": formattedDataObj[document].aiInvoicesSDNonExtractedCount || "0",
                    "AI SD Count": formattedDataObj[document].aiSdCount || "0",
                    "AI SD Total Pages Count": formattedDataObj[document].aiSdTotalPages || "0",
                    "OCR status": formattedDataObj[document].aiStatus || "NA",
                    "Invoice Count": formattedDataObj[document].invoiceCount || "0",
                    "Invoice Total Pages Count": formattedDataObj[document].invoiceTotalPages || "0",
                    "Invoice Total Extracted Pages Count": formattedDataObj[document].invoicesExtractedCount || "0",
                    "Invoice Total Non Extracted Pages Count": formattedDataObj[document].invoicesSDNonExtractedCount || "0",
                    "SD Count": formattedDataObj[document].sdCount || "0",
                    "SD Total Pages Count": formattedDataObj[document].sdTotalPages || "0",
                    "Number Of Pages in entire file": formattedDataObj[document].totalPages || "0",
                    "Team Name": customersTeam[formattedDataObj[document].externalCustomerId] || "NA",
                    "Classification Review Status": docClassification,
                    "Classified By": (formattedDataObj[document].classifiedBy
                        && users[formattedDataObj[document].classifiedBy]
                        && users[formattedDataObj[document].classifiedBy].name) || "NA",
                    "Final Review Status": formattedDataObj[document].isFileReviewed ? "COMPLETED" : "PENDING",
                    "1st Reviewer Name": (formattedDataObj[document].reviewedBy
                        && users[formattedDataObj[document].reviewedBy]
                        && users[formattedDataObj[document].reviewedBy].name) || "NA",
                    "1st Reviewer Role": formattedDataObj[document].reviewRole || "NA",
                    "1st Review Date and time": formattedDataObj[document].reviewedAt ? moment(formattedDataObj[document].reviewedAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                    "2nd Reviewer Name": (formattedDataObj[document].reviewAcceptedBy
                        && users[formattedDataObj[document].reviewAcceptedBy]
                        && users[formattedDataObj[document].reviewAcceptedBy].name) || "NA",
                    "2nd Reviewer Role": (formattedDataObj[document].reviewAcceptedBy
                        && users[formattedDataObj[document].reviewAcceptedBy]
                        && users[formattedDataObj[document].reviewAcceptedBy].role
                        && roles[users[formattedDataObj[document].reviewAcceptedBy]]
                        && roles[users[formattedDataObj[document].reviewAcceptedBy].role]) || "NA",
                    "2nd Review Date and time": formattedDataObj[document].revieweAcceptedAt ? moment(formattedDataObj[document].revieweAcceptedAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                    // "File Downloaded Date and Time": formattedDataObj[document].documentDownloadedAt ? moment(formattedDataObj[document].documentDownloadedAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                    "Ocr Api": formattedDataObj[document].ocrUrl,
                    "Uploaded Doc Type": formattedDataObj[document].uploadedDocType
                }
                formattedDataArray.push(formattedObj);
            }
            cb();
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
            if (!payload.sendResponseAsJson) {
                if (formattedDataArray.length === 0) return cb();

                console.log("INSIDE CREATE XLS:", formattedDataArray.length);
                async.forEachOf(formattedDataArray, async (formattedChunkArray, key) => {
                    console.log("SUBARRAY LENGTH:", formattedChunkArray.length, "KEY:", key);
                    try {
                        const options = {
                            output: 'binary',
                            nodeExcel: {}
                        };

                        const xlsBinary = await json2xlsAsync(formattedChunkArray, options);
                        const fileName = `IDP_DOC_LIFECYCLE_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR DOC_LIFECYCLE_REPORT:", filePath);
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
            if (!payload.sendResponseAsJson) {
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
            } else {
                cb()
            }
        }],

        sendEmail: ['sendFileToServer', 'insertIntoReportList', (res, cb) => {
            // return cb()
            if (!payload.sendResponseAsJson) {
                const dataToSend = {
                    subject: `IDP Doc Lifecycle Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                    html: '',
                    // notificationType: "idp_backend_report",
                    // attachmentNames: [],
                    // triggerNow: true
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
                        if (newFileName) {
                            reportLinkString += `${i.toString()}. https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}<br><br>`;
                            reportsLinksArray.push(`https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}`)
                        }
                    }
                    dataToSend.html = `Please find the report in the links below: <br>${reportLinkString}`;
                }
                if (payload.sendCombinedMail) {
                    if (reportLinkString) {
                        return cb(null, reportLinkString)
                    }
                    return cb(null, "No Data Found to create report - DocLifecycle report")
                }
                ImcAPIEndPoints.sendEmail({
                    subject: dataToSend.subject,
                    body: dataToSend.html,
                    apiTarget: 'REPORTS'
                }).then(() => { cb() }).catch((e) => { cb(e) });
            } else {
                cb()
            }
        }],
        updateReportsListDB: ['sendEmail', (res, cb) => {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "COMPLETED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (err) => {
                if (err) {
                    console.error("reportsListService.update err", err)
                    return cb(err)
                }
                console.log("DOC_LIFECYCLE_REPORT successfully updated into reportlist")
                cb()
            })
        }]
    }, (err, res) => {
        // console.log("mtd res::::", res)
        if (err) {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "FAILED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (error) => {
                if (error) {
                    console.erroror("reportsListService.update err", error)
                }
                console.log("DOC_LIFECYCLE_REPORT successfully updated into reportlist in err")
                callback(err);
            })
        } else {
            if (payload.sendCombinedMail) {
                return callback(null, res.sendEmail)
            }
            if (!payload.sendResponseAsJson) {
                return callback(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    message: "Request accepted, proccessing the report."
                });
            }
            return callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                data: formattedDataArray
            })
        }
    })
}
const getExtractionReport = ({ id, name, tenantId, time, email }, payload, callback) => {
    console.log("payloadddd getExtractionReport::::", payload)
    console.log("reports tenantId ::::", tenantId)
    const startDate = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString()
    let endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
    if (time && time === "8PM") {
        endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).hours(19).startOf('hour').toISOString()
        console.log("8PM endDate::", endDate)
    }
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE)
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE)
    const dateRangeInDays = date2.diff(date1, "days");
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    let documentsArray = [];
    const roles = {};
    const customersTeam = {};
    let formattedDataArray = [];
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    let reportId = null
    let userName = name
    const { tenantName = "mark_buckley" } = payload
    async.auto({
        getUserName: (cb) => {
            if (!name) {
                userService.findOne({ _id: id }, { firstName: 1 }, { lean: true }, null, (err, res) => {
                    if (err) {
                        console.error("userService err:", err)
                        return cb(err)
                    }
                    if (res) {
                        userName = res.firstName
                    }
                    cb()
                })
            } else {
                cb()
            }
        },
        insertIntoReportList: ["getUserName", (res, cb) => {
            const dataToInsert = {
                createdByUser: userName || email,
                reportName: `EXTRACTION_REPORT_${payload.startDate}-${payload.endDate}`,
                status: "PENDING",
                tenantId,
                reportType: "EXTRACTION",
                isDownloaded: false,
                reportLinks: []
            }
            reportsListService.create(dataToInsert, (err, res) => {
                if (err) {
                    console.error("reportsListService.create err:", err)
                    return cb(err)
                }
                reportId = res._id
                console.log("EXTRACTION_REPORT successfully inserted into reportlist")
                cb()
            })
        }],
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name: tenantName }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = res._id
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                cb()
            }
        },
        getTicketData: ['getTenantId', (_, cb) => {
            const criteria = {
                reviewedAt: {
                    $gte: startDate,
                    $lte: endDate
                },
                tenantId,
                qcStatus: { $in: ["COMPLETED", "ASSIGNED_SUPERVISOR"] },
            };
            const projection = {
                externalCustomerId: 1,
                mapping: 1,
                createdAt: 1,
                fileOriginalName: 1,
                ocrRequestTime: 1,
                ocrResponseTime: 1,
                reviewedAt: 1,
                external: 1,
                aiUniqueId: 1,
                aiDocType: 1,
                docType: 1,
                pageArray: 1,
                keyExtractRequestTime: 1,
                keyExtractResponseTime: 1,
                idpId: 1,
                pageRange: 1,
                filesMerged: 1,
                uploadedDocType: 1
            };
            const option = {
                lean: true
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("result::::", result)
                    documentsArray = result || [];
                    // console.log("criteria:::", criteria, documentsArray)
                    cb();
                }
            })
        }],
        findLatestPages: ['getTicketData', (_, cb) => {
            async.eachLimit(documentsArray, 10, (doc, ecb) => {
                if (doc.pageArray && doc.pageArray[0]) {
                    return ecb() // old document
                }
                // new document
                PAGE.find({ documentId: doc._id }).lean().exec((e, pages) => {
                    if (pages && pages[0]) {
                        doc.pageArray = pages
                    }
                    ecb()
                })
            }, cb)
        }],
        getRolesData: ['getTicketData', (res, cb) => {
            roleService.findAll({}, { role: 1, _id: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("roleService.findAll err:", err);
                    cb(err);
                } else {
                    for (const role in result) {
                        roles[role._id] = role
                    }
                    cb();
                }
            })
        }],
        getCustomersData: ['getRolesData', (res, cb) => {
            customersService.findAll({ tenantId }, { teamName: 1, customersArray: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("customersService.findAll err:", err);
                    cb(err);
                } else {
                    for (const team in result) {
                        for (const customer in team.customersArray) {
                            if (!(customer in customersTeam)) {
                                customersTeam[customer] = team.teamName
                            }
                        }
                    }
                    // console.log("customerTeam:::", customersTeam)
                    cb();
                }
            })
        }],
        formatData: ['getCustomersData', 'findLatestPages', (res, cb) => {
            if (!documentsArray.length) {
                console.log("no documents found in db")
                return cb();
            }
            let srNo = 0
            for (const document of documentsArray) {
                const pageDetails = {}
                const pageDetailsFeedBack = {}

                let isPageRotated = false
                let strategyChanged = false
                if (document.pageArray) {
                    for (const page of document.pageArray) {
                        if (page.sumRotateByDegree && page.sumRotateByDegree !== 0) {
                            isPageRotated = true
                        }
                        if (Array.isArray(page.ocrStrategy) && (page.ocrStrategy.includes("A") || page.ocrStrategy.includes("B") || page.ocrStrategy.includes("C"))) {
                            strategyChanged = true
                        }
                        for (const content of page.nonTabularContent) {
                            if (!(content.global_key in pageDetails)) {
                                pageDetails[content.global_key] = {
                                    edited_value: content.local_value.edited_value,
                                    text: content.local_value.text
                                }
                            }
                            if (content.global_key) {
                                pageDetailsFeedBack[`${content.global_key} Feedback Applied`] = content['feedback_applied'] ? "YES" : "NO"
                            }
                        }
                        for (const content of page.tabularContent) {
                            // TODO table content feedback applied
                            // if (!(content.global_key in pageDetailsFeedBack)) {
                            //     pageDetailsFeedBack[`${content.global_key} Feedback Applied`] = content['feedback_applied']
                            // }
                        }
                    }
                }
                if ("docType" in document && document.docType !== '#NEW_FORMAT#') {
                    srNo += 1
                    let pageRange = document.pageRange && document.pageRange.split(",")
                    if (pageRange && pageRange.length) {
                        const firstPage = pageRange[0]
                        const lastPage = pageRange[pageRange.length - 1]
                        pageRange = `${firstPage}-${lastPage}`
                        if (firstPage === lastPage) {
                            pageRange = `${firstPage}`
                        }
                    } else {
                        pageRange = ''
                    }
                    console.log("pageDetailsFeedBackpageDetailsFeedBack:", pageDetailsFeedBack)
                    const formattedObj = {
                        "Sr No": srNo.toString(),
                        "Customer Id": document.externalCustomerId || "NA",
                        "Vendor Id": (document.mapping && document.mapping["Vendor ID"]) || "NA",
                        "Upload Date": document.createdAt ? moment(document.createdAt).tz('America/Chicago').format('DD-MM-YYYY') : "NA",
                        "Upload Time": document.createdAt ? moment(document.createdAt).tz('America/Chicago').format('HH:mm:ss') : "NA",
                        "AI Process Request Time": document.ocrRequestTime ? moment(document.ocrRequestTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "AI Process Response Time": document.ocrResponseTime ? moment(document.ocrResponseTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "Indexer Review Date and time": document.reviewedAt ? moment(document.reviewedAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "External Batch Id": (document.external && document.external.batchId) || "NA",
                        "File Name": document.fileOriginalName || "NA",
                        "Doc Id": (document.external && document.external.docId) || "NA",
                        "AI Unique Id": document.aiUniqueId || "NA",
                        "AI Doc Type": document.aiDocType || "NA",
                        "Rev Doc Type": document.docType || "NA",
                        "Is Page Rotated": isPageRotated ? "YES" : "NO",
                        "AI Invoice Number": (pageDetails["Invoice Number"] && pageDetails["Invoice Number"].text !== null) ? pageDetails["Invoice Number"].text : "NULL",
                        "Rev Invoice Number": (pageDetails["Invoice Number"] && pageDetails["Invoice Number"].edited_value !== null) ? pageDetails["Invoice Number"].edited_value : "NULL",
                        "AI Invoice Date": (pageDetails["Invoice Date"] && pageDetails["Invoice Date"].text !== null) ? pageDetails["Invoice Date"].text : "NULL",
                        "Rev Invoice Date": (pageDetails["Invoice Date"] && pageDetails["Invoice Date"].edited_value !== null) ? pageDetails["Invoice Date"].edited_value : "NULL",
                        "AI PO Number": (pageDetails["Purchase Order Number"] && pageDetails["Purchase Order Number"].text !== null) ? pageDetails["Purchase Order Number"].text : "NULL",
                        "Rev PO Number": (pageDetails["Purchase Order Number"] && pageDetails["Purchase Order Number"].edited_value !== null) ? pageDetails["Purchase Order Number"].edited_value : "NULL",
                        "AI PO Date": (pageDetails["Purchase Order Date"] && pageDetails["Purchase Order Date"].text !== null) ? pageDetails["Purchase Order Date"].text : "NULL",
                        "Rev PO Date": (pageDetails["Purchase Order Date"] && pageDetails["Purchase Order Date"].edited_value !== null) ? pageDetails["Purchase Order Date"].edited_value : "NULL",
                        "AI Invoice Amount": (pageDetails["Total Invoice Amount"] && pageDetails["Total Invoice Amount"].text !== null) ? pageDetails["Total Invoice Amount"].text : "NULL",
                        "Rev Invoice Amount": (pageDetails["Total Invoice Amount"] && pageDetails["Total Invoice Amount"].edited_value !== null) ? pageDetails["Total Invoice Amount"].edited_value : "NULL",
                        "AI Total Tax Amount": (pageDetails["Total Tax Amount"] && pageDetails["Total Tax Amount"].text !== null) ? pageDetails["Total Tax Amount"].text : "NULL",
                        "Rev Total Tax Amount": (pageDetails["Total Tax Amount"] && pageDetails["Total Tax Amount"].edited_value !== null) ? pageDetails["Total Tax Amount"].edited_value : "NULL",
                        "AI Invoice SubTotal": (pageDetails["Invoice Sub Total"] && pageDetails["Invoice Sub Total"].text !== null) ? pageDetails["Invoice Sub Total"].text : "NULL",
                        "Rev Invoice SubTotal": (pageDetails["Invoice Sub Total"] && pageDetails["Invoice Sub Total"].edited_value !== null) ? pageDetails["Invoice Sub Total"].edited_value : "NULL",
                        "AI Invoice Freight": (pageDetails["Invoice Freight"] && pageDetails["Invoice Freight"].text !== null) ? pageDetails["Invoice Freight"].text : "NULL",
                        "Rev Invoice Freight": (pageDetails["Invoice Freight"] && pageDetails["Invoice Freight"].edited_value !== null) ? pageDetails["Invoice Freight"].edited_value : "NULL",
                        "AI Supplier Name": (pageDetails["Vendor Name"] && pageDetails["Vendor Name"].text !== null) ? pageDetails["Vendor Name"].text : "NULL",
                        "Rev Supplier Name": (pageDetails["Vendor Name"] && pageDetails["Vendor Name"].edited_value !== null) ? pageDetails["Vendor Name"].edited_value : "NULL",
                        "AI Supplier Address": (pageDetails["Vendor Address"] && pageDetails["Vendor Address"].text !== null) ? pageDetails["Vendor Address"].text : "NULL",
                        "Rev Supplier Address": (pageDetails["Vendor Address"] && pageDetails["Vendor Address"].edited_value !== null) ? pageDetails["Vendor Address"].edited_value : "NULL",
                        "AI Supplier Reg Number": (pageDetails["Vendor Registration Number"] && pageDetails["Vendor Registration Number"].text !== null) ? pageDetails["Vendor Registration Number"].text : "NULL",
                        "Rev Supplier Reg Number": (pageDetails["Vendor Registration Number"] && pageDetails["Vendor Registration Number"].edited_value !== null) ? pageDetails["Vendor Registration Number"].edited_value : "NULL",
                        "AI Account Number": (pageDetails["Account Number"] && pageDetails["Account Number"].text !== null) ? pageDetails["Account Number"].text : "NULL",
                        "Rev Account Number": (pageDetails["Account Number"] && pageDetails["Account Number"].edited_value !== null) ? pageDetails["Account Number"].edited_value : "NULL",
                        "AI Job Number": (pageDetails["Job Number"] && pageDetails["Job Number"].text !== null) ? pageDetails["Job Number"].text : "NULL",
                        "Rev Job Number": (pageDetails["Job Number"] && pageDetails["Job Number"].edited_value !== null) ? pageDetails["Job Number"].edited_value : "NULL",
                        "AI Loan Number": (pageDetails["Loan Number"] && pageDetails["Loan Number"].text !== null) ? pageDetails["Loan Number"].text : "NULL",
                        "Rev Loan Number": (pageDetails["Loan Number"] && pageDetails["Loan Number"].edited_value !== null) ? pageDetails["Loan Number"].edited_value : "NULL",
                        "AI Sub Contract Number": (pageDetails["Sub Contract Number"] && pageDetails["Sub Contract Number"].text !== null) ? pageDetails["Sub Contract Number"].text : "NULL",
                        "Rev Sub Contract Number": (pageDetails["Sub Contract Number"] && pageDetails["Sub Contract Number"].edited_value !== null) ? pageDetails["Sub Contract Number"].edited_value : "NULL",
                        "KV request": document.keyExtractRequestTime ? moment(document.keyExtractRequestTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "KV response": document.keyExtractResponseTime ? moment(document.keyExtractResponseTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "Ocr Strategy changed ": strategyChanged ? "YES" : "NO",
                        "Batch Id": document.idpId && document.idpId.toString(),
                        "Page Range": pageRange,
                        "filesMerged": (document.filesMerged && document.filesMerged.map(f => f.fileOriginalName).join()) || '',
                        "Uploaded Doc Type": document.uploadedDocType || "Invoices Custom",
                        ...pageDetailsFeedBack
                    }
                    formattedDataArray.push(formattedObj);
                }
            }
            // console.log("formattedDataArray::::", formattedDataArray)
            cb();
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
                console.log("TOTAL CHUNKS OF EXTRACTION REPORT:", formattedDataArray.length);
            }
            cb();
        }],

        createXls: ['splitData', (res, cb) => {
            if (!payload.sendResponseAsJson) {
                if (formattedDataArray.length === 0) return cb();

                console.log("INSIDE CREATE XLS:", formattedDataArray.length);
                async.forEachOf(formattedDataArray, async (formattedChunkArray, key) => {
                    console.log("SUBARRAY LENGTH:", formattedChunkArray.length, "KEY:", key);
                    try {
                        const options = {
                            output: 'binary',
                            nodeExcel: {}
                        };

                        const xlsBinary = await json2xlsAsync(formattedChunkArray, options);
                        const fileName = `IDP_EXTRACTION_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR EXTRACTION_REPORT:", filePath);

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
            if (!payload.sendResponseAsJson) {
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
            } else {
                cb()
            }
        }],

        sendEmail: ['sendFileToServer', 'insertIntoReportList', (res, cb) => {
            // return cb()
            if (!payload.sendResponseAsJson) {
                const dataToSend = {
                    subject: `IDP Extraction Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                    html: '',
                    // notificationType: "idp_backend_report",
                    // attachmentNames: [],
                    // triggerNow: true
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
                        if (newFileName) {
                            reportLinkString += `${i.toString()}. https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}<br><br>`;
                            reportsLinksArray.push(`https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}`)
                        }
                    }
                    dataToSend.html = `Please find the report in the links below: <br>${reportLinkString}`;
                }
                if (payload.sendCombinedMail) {
                    if (reportLinkString) {
                        return cb(null, reportLinkString)
                    }
                    return cb(null, "No Data Found to create report - Extraction report")
                }
                ImcAPIEndPoints.sendEmail({
                    subject: dataToSend.subject,
                    body: dataToSend.html,
                    apiTarget: 'REPORTS'
                }).then(() => { cb() }).catch((e) => { cb(e) });
            } else {
                cb()
            }
        }],
        updateReportsListDB: ['sendEmail', (res, cb) => {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "COMPLETED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (err) => {
                if (err) {
                    console.error("reportsListService.update err", err)
                    return cb(err)
                }
                console.log("EXTRACTION_REPORT successfully updated into reportlist")
                cb()
            })
        }]
    }, (err, res) => {
        // console.log("mtd res::::", res)
        if (err) {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "FAILED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (error) => {
                if (error) {
                    console.erroror("reportsListService.update err", error)
                }
                console.log("EXTRACTION_REPORT successfully updated into reportlist in err")
                callback(err);
            })
        } else {
            if (payload.sendCombinedMail) {
                return callback(null, res.sendEmail)
            }
            if (!payload.sendResponseAsJson) {
                return callback(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    message: "Request accepted, proccessing the report."
                });
            }
            return callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                data: formattedDataArray
            })
        }
    })
}
const getClassificationReport = ({ id, name, tenantId, time, email }, payload, callback) => {
    console.log("payloadddd getClassificationReport::::", payload)
    console.log("reports tenantId ::::", tenantId)
    const startDate = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString()
    let endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
    if (time && time === "8PM") {
        endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).hours(19).startOf('hour').toISOString()
        console.log("8PM endDate::", endDate)
    }
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE)
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE)
    const dateRangeInDays = date2.diff(date1, "days");
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    let documentsArray = [];
    let formattedDataArray = [];
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    let reportId = null
    let userName = name
    const { tenantName = "mark_buckley" } = payload
    async.auto({
        getUserName: (cb) => {
            if (!name) {
                userService.findOne({ _id: id }, { firstName: 1 }, { lean: true }, null, (err, res) => {
                    if (err) {
                        console.error("userService err:", err)
                        return cb(err)
                    }
                    if (res) {
                        userName = res.firstName
                    }
                    cb()
                })
            } else {
                cb()
            }
        },
        insertIntoReportList: ["getUserName", (res, cb) => {
            const dataToInsert = {
                createdByUser: userName || email,
                reportName: `CLASSIFICATION_REPORT_${payload.startDate}-${payload.endDate}`,
                status: "PENDING",
                tenantId,
                reportType: "CLASSIFICATION",
                isDownloaded: false,
                reportLinks: []
            }
            reportsListService.create(dataToInsert, (err, res) => {
                if (err) {
                    console.error("reportsListService.create err:", err)
                    return cb(err)
                }
                reportId = res._id
                console.log("CLASSIFICATION_REPORT successfully inserted into reportlist")
                cb()
            })
        }],
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name: tenantName }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = res._id
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                cb()
            }
        },
        getTicketData: ['getTenantId', (_, cb) => {
            const criteria = {
                classifiedAt: {
                    $gte: startDate,
                    $lte: endDate
                },
                classification: "COMPLETED",
                tenantId
            };
            const projection = {
                fileOriginalName: 1,
                fileName: 1,
                aiDocType: 1,
                docType: 1,
                classifiedAt: 1,
                createdAt: 1
            };
            const option = {
                lean: true
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    documentsArray = result || [];
                    // console.log("result::::", documentsArray)
                    cb();
                }
            })
        }],
        formatData: ['getTicketData', (res, cb) => {
            if (!documentsArray.length) {
                console.log("no documents found in db")
                return cb();
            }

            const formattedDataObj = {};
            for (const documentObj of documentsArray) {
                if (documentObj && documentObj.fileName in formattedDataObj) {
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            formattedDataObj[documentObj.fileName]['aiInvoiceCount'] += 1
                        } else {
                            formattedDataObj[documentObj.fileName]['aiSDCount'] += 1
                        }
                    }
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            formattedDataObj[documentObj.fileName]['docInvoiceCount'] += 1
                        } else {
                            formattedDataObj[documentObj.fileName]['docSDCount'] += 1
                        }
                    }
                } else {
                    let aiInvoice = false
                    let aiSDInvoice = false
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            aiInvoice = true
                        } else {
                            aiSDInvoice = true
                        }
                    }
                    let docInvoice = false
                    let docSDInvoice = false
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            docInvoice = true
                        } else {
                            docSDInvoice = true
                        }
                    }
                    formattedDataObj[documentObj.fileName] = {
                        aiInvoiceCount: aiInvoice ? 1 : 0,
                        aiSDCount: aiSDInvoice ? 1 : 0,
                        docInvoiceCount: docInvoice ? 1 : 0,
                        docSDCount: docSDInvoice ? 1 : 0,
                        classifiedAt: documentObj.classifiedAt || "",
                        createdAt: documentObj.createdAt || "",
                        fileOriginalName: documentObj.fileOriginalName || "",
                    };
                }
            }
            let srNo = 0
            // console.log("formattedDataObj::::", formattedDataObj)
            for (const document in formattedDataObj) {
                srNo += 1
                const formattedObj = {
                    "Sr No": srNo.toString(),
                    "File Name": formattedDataObj[document].fileOriginalName || "NA",
                    "AI Invoice Count": formattedDataObj[document].aiInvoiceCount || "0",
                    "Rev_Invoice Count": formattedDataObj[document].docInvoiceCount || "0",
                    "AI SD Count": formattedDataObj[document].aiSDCount || "0",
                    "Rev_SD Count": formattedDataObj[document].docSDCount || "0",
                    "Classification Date & Time": formattedDataObj[document].classifiedAt ? moment(formattedDataObj[document].classifiedAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                    "File upload Date & Time": formattedDataObj[document].createdAt ? moment(formattedDataObj[document].createdAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                    "AI Success": ((formattedDataObj[document].aiInvoiceCount === formattedDataObj[document].docInvoiceCount)
                        && (formattedDataObj[document].aiSDCount === formattedDataObj[document].docSDCount)) ? "TRUE" : "FALSE"
                }
                formattedDataArray.push(formattedObj);
            }
            // console.log("formattedDataArray::::", formattedDataArray)
            cb();
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
                console.log("TOTAL CHUNKS OF CLASSIFICATION REPORT:", formattedDataArray.length);
            }
            cb();
        }],

        createXls: ['splitData', (res, cb) => {
            if (!payload.sendResponseAsJson) {
                if (formattedDataArray.length === 0) return cb();

                console.log("INSIDE CREATE XLS:", formattedDataArray.length);
                async.forEachOf(formattedDataArray, async (formattedChunkArray, key) => {
                    console.log("SUBARRAY LENGTH:", formattedChunkArray.length, "KEY:", key);
                    try {
                        const options = {
                            output: 'binary',
                            nodeExcel: {}
                        };

                        const xlsBinary = await json2xlsAsync(formattedChunkArray, options);
                        const fileName = `IDP_CLASSIFICATION_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR CLASSIFICATION_REPORT:", filePath);
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
            if (!payload.sendResponseAsJson) {
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
            } else {
                cb()
            }
        }],

        sendEmail: ['sendFileToServer', 'insertIntoReportList', (res, cb) => {
            // return cb()
            if (!payload.sendResponseAsJson) {
                const dataToSend = {
                    subject: `IDP CLASSIFICATION Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                    html: '',
                    // notificationType: "idp_backend_report",
                    // attachmentNames: [],
                    // triggerNow: true
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
                        if (newFileName) {
                            reportLinkString += `${i.toString()}. https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}<br><br>`;
                            reportsLinksArray.push(`https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}`)
                        }
                    }
                    dataToSend.html = `Please find the report in the links below: <br>${reportLinkString}`;
                }
                if (payload.sendCombinedMail) {
                    if (reportLinkString) {
                        return cb(null, reportLinkString)
                    }
                    return cb(null, "No Data Found to create report - Classification report")
                }
                ImcAPIEndPoints.sendEmail({
                    subject: dataToSend.subject,
                    body: dataToSend.html,
                    apiTarget: 'REPORTS'
                }).then(() => { return cb() })
                    .catch((e) => { return cb(e) });
            } else {
                return cb()
            }
        }],
        updateReportsListDB: ['sendEmail', (res, cb) => {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "COMPLETED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (err) => {
                if (err) {
                    console.error("reportsListService.update err", err)
                    return cb(err)
                }
                console.log("CLASSIFICATION_REPORT successfully updated into reportlist")
                cb()
            })
        }]
    }, (err, res) => {
        // console.log("mtd res::::", res)
        if (err) {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "FAILED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (error) => {
                if (error) {
                    console.erroror("reportsListService.update err", error)
                }
                console.log("CLASSIFICATION_REPORT successfully updated into reportlist in err")
                callback(err);
            })
        } else {
            if (payload.sendCombinedMail) {
                return callback(null, res.sendEmail)
            }
            if (!payload.sendResponseAsJson) {
                return callback(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    message: "Request accepted, proccessing the report."
                });
            }
            return callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                data: formattedDataArray
            })
        }
    })
}
const getMTDReport = ({ id, name, tenantId }, payload, callback) => {
    console.log("payloadddd getMTDReport::::", payload)
    console.log("reports tenantId ::::", tenantId)
    let documentsReviewedArray = [];
    let documentsClassifiedArray = [];
    let documentsUploadedArray = [];
    let formattedDataArray = [];
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    let reportId = null
    let userName = name
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE)
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE)
    const dateRangeInDays = date2.diff(date1, "days");
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    const { tenantName = "mark_buckley" } = payload
    async.auto({

        getUserName: (cb) => {
            if (!name) {
                userService.findOne({ _id: id }, { firstName: 1 }, { lean: true }, null, (err, res) => {
                    if (err) {
                        console.error("userService err:", err)
                        return cb(err)
                    }
                    if (res) {
                        userName = res.firstName
                    }
                    cb()
                })
            } else {
                cb()
            }
        },
        insertIntoReportList: ["getUserName", (res, cb) => {
            const dataToInsert = {
                createdByUser: userName,
                reportName: `MTD_REPORT_${payload.startDate}-${payload.endDate}`,
                status: "PENDING",
                tenantId,
                reportType: "MTD",
                isDownloaded: false,
                reportLinks: []
            }
            reportsListService.create(dataToInsert, (err, res) => {
                if (err) {
                    console.error("reportsListService.create err:", err)
                    return cb(err)
                }
                reportId = res._id
                console.log("MTD_REPORT successfully inserted into reportlist")
                cb()
            })
        }],
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name: tenantName }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = res._id
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                cb()
            }
        },
        getUploadedTicketData: ['insertIntoReportList', 'getTenantId', (res, cb) => {
            // console.log("inside getUploadedTicketData report")
            const criteria = {
                createdAt: {
                    $gte: moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString(),
                    $lte: moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
                },
                tenantId
            };
            const projection = {
                fileName: 1,
                aiDocType: 1,
                docType: 1,
                reviewedAt: 1,
                createdAt: 1,
                pageArray: 1
            };
            const option = {
                lean: true,
                $sort: { updatedAt: -1 }
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("result::::", result)
                    documentsUploadedArray = result || [];
                    console.log("documentsUploadedArray len", documentsUploadedArray.length)
                    cb();
                }
            })
        }],
        getReviewedTicketData: ['getUploadedTicketData', (res, cb) => {
            // console.log("inside getReviewedTicketData report")
            const criteria = {
                reviewedAt: {
                    $gte: moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString(),
                    $lte: moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
                },
                qcStatus: { $in: ["COMPLETED", "ASSIGNED_SUPERVISOR"] },
                tenantId
            };
            const projection = {
                fileName: 1,
                aiDocType: 1,
                docType: 1,
                pageArray: 1,
                qcStatus: 1,
                createdAt: 1,
                reviewedAt: 1
            };
            const option = {
                lean: true
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("result::::", result)
                    documentsReviewedArray = result || [];
                    console.log("documentsReviewedArray len", documentsReviewedArray.length)

                    cb();
                }
            })
        }],
        getClassifiedTicketData: ['getReviewedTicketData', (res, cb) => {
            const criteria = {
                classifiedAt: {
                    $gte: moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString(),
                    $lte: moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
                },
                classification: "COMPLETED",
                tenantId
            };
            const projection = {
                fileOriginalName: 1,
                fileName: 1,
                aiDocType: 1,
                docType: 1,
                classifiedAt: 1
            };
            const option = {
                lean: true
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    documentsClassifiedArray = result || [];
                    console.log("documentsClassifiedArray.len::::", documentsClassifiedArray.length)
                    cb();
                }
            })
        }],
        formatData: ['getClassifiedTicketData', (res, cb) => {
            // console.log("inside formatdata report")
            if (!documentsReviewedArray.length && !documentsUploadedArray.length && !documentsClassifiedArray.length) {
                console.log("no documents found in db")
                return cb();
            }
            const classifiedDocFormattedDataObj = {};
            const uploadedDocFormattedDataObj = {};
            const finalFormattedDataObj = {}
            const dates = getDateRangeBetweenTwoDates(payload.startDate, payload.endDate)
            console.log("dates Range for mtd report", dates)
            for (const currDate of dates) {
                finalFormattedDataObj[currDate] = {
                    totalUploadedFiles: 0,
                    totalUploadedDocs: 0,
                    totalUploadedInvoices: 0,
                    totalUploadedInvoicesPages: 0,
                    totalUploadedFilePages: 0,
                    totalExtractedPages: 0,
                    totalClassificationReviewedFiles: 0,
                    totalExtractionReviewedDocs: 0,
                    reviewedClassificationCorrect: 0,
                    reviewedExtractionCorrect: 0
                }
            }
            console.log("finished date obj:::")
            for (const documentObj of documentsReviewedArray) {
                const reviewedAt = moment(documentObj.reviewedAt).tz('America/Chicago').format('DD-MM-YYYY')
                let aiExtractCorrect = true
                let doesPagesExist = false
                if (documentObj.qcStatus === 'COMPLETED' || documentObj.qcStatus === 'ASSIGNED_SUPERVISOR') {
                    if (documentObj.pageArray) {
                        for (const page of documentObj.pageArray) {
                            for (const content of page.nonTabularContent) {
                                doesPagesExist = true
                                if (content.local_value.edited_value !== content.local_value.text) {
                                    aiExtractCorrect = false
                                    break
                                }
                            }
                        }
                    }
                }
                finalFormattedDataObj[reviewedAt].totalExtractionReviewedDocs += (documentObj.docType !== '#NEW_FORMAT#' && (documentObj.qcStatus === 'COMPLETED' || documentObj.qcStatus === 'ASSIGNED_SUPERVISOR') ? 1 : 0)
                finalFormattedDataObj[reviewedAt].reviewedExtractionCorrect += (aiExtractCorrect === true && doesPagesExist ? 1 : 0)
            }
            for (const documentObj of documentsClassifiedArray) {
                if (documentObj && documentObj.fileName in classifiedDocFormattedDataObj) {
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            classifiedDocFormattedDataObj[documentObj.fileName]['aiInvoiceCount'] += 1
                        } else {
                            classifiedDocFormattedDataObj[documentObj.fileName]['aiSDCount'] += 1
                        }
                    }
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            classifiedDocFormattedDataObj[documentObj.fileName]['docInvoiceCount'] += 1
                        } else {
                            classifiedDocFormattedDataObj[documentObj.fileName]['docSDCount'] += 1
                        }
                    }
                    classifiedDocFormattedDataObj[documentObj.fileName]["docCount"] += 1;
                } else {
                    let aiInvoice = false
                    let aiSDInvoice = false
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            aiInvoice = true
                        } else {
                            aiSDInvoice = true
                        }
                    }
                    let docInvoice = false
                    let docSDInvoice = false
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            docInvoice = true
                        } else {
                            docSDInvoice = true
                        }
                    }
                    classifiedDocFormattedDataObj[documentObj.fileName] = {
                        aiInvoiceCount: aiInvoice ? 1 : 0,
                        aiSDCount: aiSDInvoice ? 1 : 0,
                        docInvoiceCount: docInvoice ? 1 : 0,
                        docSDCount: docSDInvoice ? 1 : 0,
                        docCount: 1,
                        classifiedAt: documentObj.classifiedAt || "",
                    };
                }
            }
            for (const file in classifiedDocFormattedDataObj) {
                const classifiedAt = moment(classifiedDocFormattedDataObj[file].classifiedAt).tz('America/Chicago').format('DD-MM-YYYY')
                finalFormattedDataObj[classifiedAt].totalClassificationReviewedFiles += 1
                if ((classifiedDocFormattedDataObj[file].aiInvoiceCount === classifiedDocFormattedDataObj[file].docInvoiceCount)
                    && (classifiedDocFormattedDataObj[file].aiSDCount === classifiedDocFormattedDataObj[file].docSDCount)) {
                    finalFormattedDataObj[classifiedAt].reviewedClassificationCorrect += 1
                }
            }
            // console.log("documentsReviewedArray completed")
            for (const documentObj of documentsUploadedArray) {
                // console.log("uploadeddocumentObj::::", documentObj)
                if (documentObj && documentObj.fileName in uploadedDocFormattedDataObj) {
                    uploadedDocFormattedDataObj[documentObj.fileName]['totalPages'] += (documentObj.pageArray ? documentObj.pageArray.length : 0);
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            uploadedDocFormattedDataObj[documentObj.fileName]['aiInvoiceCount'] += 1
                            uploadedDocFormattedDataObj[documentObj.fileName]['totalInvoicePages'] += (documentObj.pageArray ? documentObj.pageArray.length : 0)
                        } else {
                            uploadedDocFormattedDataObj[documentObj.fileName]['aiSDInvoiceCount'] += 1
                        }
                        if (documentObj.pageArray && documentObj.aiDocType !== '#NEW_FORMAT#') {
                            for (const eachPage of documentObj.pageArray) {
                                if (eachPage.page_type === "Invoices Custom") {
                                    uploadedDocFormattedDataObj[documentObj.fileName]["invoicesExtractedCount"] += 1
                                } else {
                                    uploadedDocFormattedDataObj[documentObj.fileName]["invoicesSDNonExtractedCount"] += 1
                                }
                            }
                        }
                    }
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            uploadedDocFormattedDataObj[documentObj.fileName]['docInvoiceCount'] += 1
                        } else {
                            uploadedDocFormattedDataObj[documentObj.fileName]['docSDInvoiceCount'] += 1
                        }
                    }
                } else {
                    let aiInvoice = false
                    let aiSDInvoice = false
                    let totalPages = 0
                    let totalInvoicePages = 0
                    let invoicesExtractedCount = 0
                    let invoicesSDNonExtractedCount = 0
                    totalPages += (documentObj.pageArray ? documentObj.pageArray.length : 0)
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            aiInvoice = true
                            totalInvoicePages += (documentObj.pageArray ? documentObj.pageArray.length : 0)
                        } else {
                            aiSDInvoice = true
                        }
                        if (documentObj.pageArray && documentObj.aiDocType !== '#NEW_FORMAT#') {
                            for (const eachPage of documentObj.pageArray) {
                                if (eachPage.page_type === "Invoices Custom") {
                                    invoicesExtractedCount += 1
                                } else {
                                    invoicesSDNonExtractedCount += 1
                                }
                            }
                        }
                    }
                    let docInvoice = false
                    let docSDInvoice = false
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            docInvoice = true
                        } else {
                            docSDInvoice = true
                        }
                    }
                    uploadedDocFormattedDataObj[documentObj.fileName] = {
                        aiInvoiceCount: aiInvoice ? 1 : 0,
                        aiSDInvoiceCount: aiSDInvoice ? 1 : 0,
                        docInvoiceCount: docInvoice ? 1 : 0,
                        docSDInvoiceCount: docSDInvoice ? 1 : 0,
                        totalPages,
                        totalInvoicePages,
                        invoicesExtractedCount,
                        invoicesSDNonExtractedCount,
                        createdAt: documentObj.createdAt || "",
                    };
                }
            }
            // console.log("documentsUploadedArray completed")
            for (const file in uploadedDocFormattedDataObj) {
                const createdAt = moment(uploadedDocFormattedDataObj[file].createdAt).tz('America/Chicago').format('DD-MM-YYYY')
                // console.log("createdAt:::", createdAt)
                finalFormattedDataObj[createdAt].totalUploadedFiles += 1
                finalFormattedDataObj[createdAt].totalUploadedDocs += uploadedDocFormattedDataObj[file].aiInvoiceCount + uploadedDocFormattedDataObj[file].aiSDInvoiceCount
                finalFormattedDataObj[createdAt].totalUploadedInvoices += uploadedDocFormattedDataObj[file].aiInvoiceCount
                finalFormattedDataObj[createdAt].totalUploadedInvoicesPages += uploadedDocFormattedDataObj[file].totalInvoicePages
                finalFormattedDataObj[createdAt].totalUploadedFilePages += uploadedDocFormattedDataObj[file].totalPages
                finalFormattedDataObj[createdAt].totalExtractedPages += uploadedDocFormattedDataObj[file].invoicesExtractedCount
            }
            let srNo = 0
            for (const date in finalFormattedDataObj) {
                // console.log("srNo:::", srNo)
                srNo += 1
                let classificationAcc = 0
                if (finalFormattedDataObj[date].totalClassificationReviewedFiles) {
                    classificationAcc = ((finalFormattedDataObj[date].reviewedClassificationCorrect * 100) / finalFormattedDataObj[date].totalClassificationReviewedFiles).toFixed(2)
                }
                let extractAcc = 0
                if (finalFormattedDataObj[date].totalExtractionReviewedDocs) {
                    extractAcc = ((finalFormattedDataObj[date].reviewedExtractionCorrect * 100) / finalFormattedDataObj[date].totalExtractionReviewedDocs).toFixed(2)
                }
                const formattedObj = {
                    "Sr No": srNo.toString(),
                    "Date": date,
                    "Total Uploaded Files": finalFormattedDataObj[date].totalUploadedFiles,
                    "Total Docs": finalFormattedDataObj[date].totalUploadedDocs,
                    "Total AI Invoices": finalFormattedDataObj[date].totalUploadedInvoices,
                    "Total Invoice Pages": finalFormattedDataObj[date].totalUploadedInvoicesPages,
                    "Total Invoice Extracted Pages": finalFormattedDataObj[date].totalExtractedPages,
                    "Total File Pages": finalFormattedDataObj[date].totalUploadedFilePages,
                    "Total Reviewed Invoices": finalFormattedDataObj[date].totalExtractionReviewedDocs,
                    "Total AI Correct Invoices": finalFormattedDataObj[date].reviewedExtractionCorrect,
                    "Total Classified Files": finalFormattedDataObj[date].totalClassificationReviewedFiles,
                    "Total AI Correct Classified Files": finalFormattedDataObj[date].reviewedClassificationCorrect,
                    "Classification Accuracy": `${classificationAcc}%` || "NA",
                    "Extraction Accuracy": `${extractAcc}%` || "NA",
                }
                formattedDataArray.push(formattedObj);
            }
            // console.log("formattedDataArray::::", formattedDataArray)
            cb();
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
                console.log("TOTAL CHUNKS OF MTD REPORT:", formattedDataArray.length);
            }
            cb();
        }],

        createXls: ['splitData', (res, cb) => {
            if (!payload.sendResponseAsJson) {
                if (formattedDataArray.length === 0) return cb();

                console.log("INSIDE CREATE XLS:", formattedDataArray.length);
                async.forEachOf(formattedDataArray, async (formattedChunkArray, key) => {
                    console.log("SUBARRAY LENGTH:", formattedChunkArray.length, "KEY:", key);
                    try {
                        const options = {
                            output: 'binary',
                            nodeExcel: {}
                        };

                        const xlsBinary = await json2xlsAsync(formattedChunkArray, options);
                        const fileName = `IDP_MTD_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR MTD_REPORT:", filePath);

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
            if (!payload.sendResponseAsJson) {
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
            } else {
                cb()
            }
        }],

        sendEmail: ['sendFileToServer', 'insertIntoReportList', (res, cb) => {
            // return cb()
            if (!payload.sendResponseAsJson) {
                const dataToSend = {
                    subject: `IDP MTD Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                    html: '',
                    // notificationType: "idp_backend_report",
                    // attachmentNames: [],
                    // triggerNow: true
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
                        if (newFileName) {
                            reportLinkString += `${i.toString()}. https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}<br><br>`;
                            reportsLinksArray.push(`https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}`)
                        }
                    }
                    dataToSend.html = `Please find the report in the links below: <br>${reportLinkString}`;
                }
                if (payload.sendCombinedMail) {
                    if (reportLinkString) {
                        return cb(null, reportLinkString)
                    }
                    return cb(null, "No Data Found to create report - MTD report")
                }
                ImcAPIEndPoints.sendEmail({
                    subject: dataToSend.subject,
                    body: dataToSend.html,
                    apiTarget: 'REPORTS'
                }).then(() => { cb() }).catch((e) => { cb(e) });
            } else {
                cb()
            }
        }],
        updateReportsListDB: ['sendEmail', (res, cb) => {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "COMPLETED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (err) => {
                if (err) {
                    console.error("reportsListService.update err", err)
                    return cb(err)
                }
                console.log("MTD_REPORT successfully updated into reportlist")
                cb()
            })
        }]
    }, (err, res) => {
        // console.log("mtd res::::", res)
        if (err) {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "FAILED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (error) => {
                if (error) {
                    console.erroror("reportsListService.update err", error)
                }
                console.log("MTD_REPORT successfully updated into reportlist in err")
                callback(err);
            })
        } else {
            if (payload.sendCombinedMail) {
                return callback(null, res.sendEmail)
            }
            if (!payload.sendResponseAsJson) {
                return callback(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    message: "Request accepted, proccessing the report."
                });
            }
            return callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                data: formattedDataArray
            })
        }
    })
}
const getDailyStats = ({ name, tenantId }, payload, callback) => {
    console.log("payloadddd::::", payload)
    let documentsReviewedArray = [];
    const finalFormattedDataObj = {}
    let documentsUploadedArray = [];
    let documentsClassifiedArray = [];
    // const formattedDataArray = [];
    // console.log("name, tenantid:", name, tenantId)
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE)
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE)
    const dateRangeInDays = date2.diff(date1, "days");
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    async.auto({
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = createMongooseId(res._id)
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                tenantId = createMongooseId(tenantId)
                cb()
            }
        },
        getUploadedTicketData: ['getTenantId', (res, cb) => {
            // console.log("inside getUploadedTicketData report")
            const criteria = {
                createdAt: {
                    $gte: moment.tz(payload.date, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString(),
                    $lte: moment.tz(payload.date, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
                },
                tenantId
            };
            console.log("getUploadedTicketData:::", criteria)
            const projection = {
                fileName: 1,
                aiDocType: 1,
                docType: 1,
                reviewedAt: 1,
                createdAt: 1,
                pageArray: 1
            };
            const option = {
                lean: true,
                $sort: { updatedAt: -1 }
            };
            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("getUploadedTicketData:::", criteria)
                    console.log("result::::", result && result.length)
                    documentsUploadedArray = result || [];
                    console.log("documentsUploadedArray len", documentsUploadedArray.length)
                    cb();
                }
            })
        }],
        getReviewedTicketData: ['getTenantId', (res, cb) => {
            // console.log("inside getReviewedTicketData report")
            const criteria = {
                reviewedAt: {
                    $gte: moment.tz(payload.date, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString(),
                    $lte: moment.tz(payload.date, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
                },
                qcStatus: { $in: ["COMPLETED", "ASSIGNED_SUPERVISOR"] },
                tenantId
            };
            console.log("getReviewedTicketData criteria:::", criteria)
            const projection = {
                fileName: 1,
                aiDocType: 1,
                docType: 1,
                pageArray: 1,
                qcStatus: 1,
                createdAt: 1,
                reviewedAt: 1
            };
            const option = {
                lean: true
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    console.log("getReviewedTicketData result::::", result && result.length)
                    documentsReviewedArray = result || [];
                    // console.log("documentsReviewedArray len", documentsReviewedArray.length)

                    cb();
                }
            })
        }],
        getClassifiedTicketData: ['getTenantId', (res, cb) => {
            const criteria = {
                classifiedAt: {
                    $gte: moment.tz(payload.date, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString(),
                    $lte: moment.tz(payload.date, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
                },
                classification: "COMPLETED",
                tenantId
            };
            console.log("getClassifiedTicketData criteria", criteria)
            const projection = {
                fileOriginalName: 1,
                fileName: 1,
                aiDocType: 1,
                docType: 1,
                classifiedAt: 1
            };
            const option = {
                lean: true
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    console.log("getClassifiedTicketData result:::", result && result.length)
                    documentsClassifiedArray = result || [];
                    // console.log("result::::", documentsClassifiedArray)
                    cb();
                }
            })
        }],
        findLatestPages: ['getUploadedTicketData', 'getReviewedTicketData', (_, cb) => {
            async.eachLimit(documentsUploadedArray.concat(documentsReviewedArray), 10, (doc, ecb) => {
                if (doc.pageArray && doc.pageArray[0]) {
                    return ecb() // old document
                }
                // new document
                PAGE.find({ documentId: doc._id }).lean().exec((e, pages) => {
                    if (pages && pages[0]) {
                        doc.pageArray = pages
                    }
                    ecb()
                })
            }, cb)
        }],
        formatData: ['getClassifiedTicketData', 'getReviewedTicketData', 'getUploadedTicketData', 'findLatestPages', (res, cb) => {
            // console.log("inside formatdata report")
            if (!documentsReviewedArray.length && !documentsUploadedArray.length) {
                console.log("no documents found in db")
                return cb();
            }
            const classifiedDocFormattedDataObj = {};
            const uploadedDocFormattedDataObj = {};
            finalFormattedDataObj[payload.date] = {
                totalUploadedFiles: 0,
                totalUploadedDocs: 0,
                totalUploadedInvoices: 0,
                totalUploadedInvoicesPages: 0,
                totalUploadedFilePages: 0,
                totalExtractedPages: 0,
                totalClassificationReviewedFiles: 0,
                totalExtractionReviewedDocs: 0,
                reviewedClassificationCorrect: 0,
                reviewedExtractionCorrect: 0
            }
            // console.log("finished date obj:::")
            for (const documentObj of documentsReviewedArray) {
                const reviewedAt = moment(documentObj.reviewedAt).tz('America/Chicago').format('DD-MM-YYYY')
                let aiExtractCorrect = true
                let doesPagesExist = false
                if (documentObj.qcStatus === 'COMPLETED' || documentObj.qcStatus === "ASSIGNED_SUPERVISOR") {
                    if (documentObj.pageArray) {
                        for (const page of documentObj.pageArray) {
                            for (const content of page.nonTabularContent) {
                                doesPagesExist = true
                                if (content.local_value.edited_value && content.local_value.edited_value !== content.local_value.text) {
                                    aiExtractCorrect = false
                                    break
                                }
                            }
                        }
                    }
                }
                finalFormattedDataObj[reviewedAt].totalExtractionReviewedDocs += ((documentObj.docType !== '#NEW_FORMAT#'
                    && (documentObj.qcStatus === 'COMPLETED'
                        || documentObj.qcStatus === 'ASSIGNED_SUPERVISOR')) ? 1 : 0)
                finalFormattedDataObj[reviewedAt].reviewedExtractionCorrect += ((aiExtractCorrect === true && doesPagesExist) ? 1 : 0)
            }
            for (const documentObj of documentsClassifiedArray) {
                if (documentObj && documentObj.fileName in classifiedDocFormattedDataObj) {
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            classifiedDocFormattedDataObj[documentObj.fileName]['aiInvoiceCount'] += 1
                        } else {
                            classifiedDocFormattedDataObj[documentObj.fileName]['aiSDCount'] += 1
                        }
                    }
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            classifiedDocFormattedDataObj[documentObj.fileName]['docInvoiceCount'] += 1
                        } else {
                            classifiedDocFormattedDataObj[documentObj.fileName]['docSDCount'] += 1
                        }
                    }
                    classifiedDocFormattedDataObj[documentObj.fileName]["docCount"] += 1;
                } else {
                    let aiInvoice = false
                    let aiSDInvoice = false
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            aiInvoice = true
                        } else {
                            aiSDInvoice = true
                        }
                    }
                    let docInvoice = false
                    let docSDInvoice = false
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            docInvoice = true
                        } else {
                            docSDInvoice = true
                        }
                    }
                    classifiedDocFormattedDataObj[documentObj.fileName] = {
                        aiInvoiceCount: aiInvoice ? 1 : 0,
                        aiSDCount: aiSDInvoice ? 1 : 0,
                        docInvoiceCount: docInvoice ? 1 : 0,
                        docSDCount: docSDInvoice ? 1 : 0,
                        docCount: 1,
                        classifiedAt: documentObj.classifiedAt || "",
                    };
                }
            }
            for (const file in classifiedDocFormattedDataObj) {
                const classifiedAt = moment(classifiedDocFormattedDataObj[file].classifiedAt).tz('America/Chicago').format('DD-MM-YYYY')
                finalFormattedDataObj[classifiedAt].totalClassificationReviewedFiles += 1
                if ((classifiedDocFormattedDataObj[file].aiInvoiceCount === classifiedDocFormattedDataObj[file].docInvoiceCount)
                    && (classifiedDocFormattedDataObj[file].aiSDCount === classifiedDocFormattedDataObj[file].docSDCount)) {
                    finalFormattedDataObj[classifiedAt].reviewedClassificationCorrect += 1
                }
            }
            console.log("finalFormattedDataObj 1962:", finalFormattedDataObj)
            // console.log("documentsReviewedArray completed")
            for (const documentObj of documentsUploadedArray) {
                // console.log("uploadeddocumentObj::::", documentObj)
                if (documentObj && documentObj.fileName in uploadedDocFormattedDataObj) {
                    uploadedDocFormattedDataObj[documentObj.fileName]['totalPages'] += (documentObj.pageArray ? documentObj.pageArray.length : 0);
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            uploadedDocFormattedDataObj[documentObj.fileName]['aiInvoiceCount'] += 1
                            uploadedDocFormattedDataObj[documentObj.fileName]['totalInvoicePages'] += (documentObj.pageArray ? documentObj.pageArray.length : 0)
                        } else {
                            uploadedDocFormattedDataObj[documentObj.fileName]['aiSDInvoiceCount'] += 1
                        }
                        if (documentObj.pageArray && documentObj.aiDocType !== '#NEW_FORMAT#') {
                            for (const eachPage of documentObj.pageArray) {
                                if (eachPage.page_type === "Invoices Custom") {
                                    uploadedDocFormattedDataObj[documentObj.fileName]["invoicesExtractedCount"] += 1
                                } else {
                                    uploadedDocFormattedDataObj[documentObj.fileName]["invoicesSDNonExtractedCount"] += 1
                                }
                            }
                        }
                    }
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            uploadedDocFormattedDataObj[documentObj.fileName]['docInvoiceCount'] += 1
                        } else {
                            uploadedDocFormattedDataObj[documentObj.fileName]['docSDInvoiceCount'] += 1
                        }
                    }
                } else {
                    let aiInvoice = false
                    let aiSDInvoice = false
                    let totalPages = 0
                    let totalInvoicePages = 0
                    let invoicesExtractedCount = 0
                    let invoicesSDNonExtractedCount = 0
                    totalPages += (documentObj.pageArray ? documentObj.pageArray.length : 0)
                    if (documentObj.aiDocType) {
                        if (documentObj.aiDocType !== '#NEW_FORMAT#') {
                            aiInvoice = true
                            totalInvoicePages += (documentObj.pageArray ? documentObj.pageArray.length : 0)
                        } else {
                            aiSDInvoice = true
                        }
                        if (documentObj.pageArray && documentObj.aiDocType !== '#NEW_FORMAT#') {
                            for (const eachPage of documentObj.pageArray) {
                                if (eachPage.page_type === "Invoices Custom") {
                                    invoicesExtractedCount += 1
                                } else {
                                    invoicesSDNonExtractedCount += 1
                                }
                            }
                        }
                    }
                    let docInvoice = false
                    let docSDInvoice = false
                    if (documentObj.docType) {
                        if (documentObj.docType !== '#NEW_FORMAT#') {
                            docInvoice = true
                        } else {
                            docSDInvoice = true
                        }
                    }
                    uploadedDocFormattedDataObj[documentObj.fileName] = {
                        aiInvoiceCount: aiInvoice ? 1 : 0,
                        aiSDInvoiceCount: aiSDInvoice ? 1 : 0,
                        docInvoiceCount: docInvoice ? 1 : 0,
                        docSDInvoiceCount: docSDInvoice ? 1 : 0,
                        totalPages,
                        totalInvoicePages,
                        invoicesExtractedCount,
                        invoicesSDNonExtractedCount,
                        createdAt: documentObj.createdAt || "",
                    };
                }
            }
            // console.log("documentsUploadedArray completed")
            for (const file in uploadedDocFormattedDataObj) {
                const createdAt = moment(uploadedDocFormattedDataObj[file].createdAt).tz('America/Chicago').format('DD-MM-YYYY')
                // console.log("createdAt:::", createdAt)
                finalFormattedDataObj[createdAt].totalUploadedFiles += 1
                finalFormattedDataObj[createdAt].totalUploadedDocs += uploadedDocFormattedDataObj[file].aiInvoiceCount + uploadedDocFormattedDataObj[file].aiSDInvoiceCount
                finalFormattedDataObj[createdAt].totalUploadedInvoices += uploadedDocFormattedDataObj[file].aiInvoiceCount
                finalFormattedDataObj[createdAt].totalUploadedInvoicesPages += uploadedDocFormattedDataObj[file].totalInvoicePages
                finalFormattedDataObj[createdAt].totalUploadedFilePages += uploadedDocFormattedDataObj[file].totalPages
                finalFormattedDataObj[createdAt].totalExtractedPages += uploadedDocFormattedDataObj[file].invoicesExtractedCount
            }
            for (const date in finalFormattedDataObj) {
                let classificationAcc = 0
                if (finalFormattedDataObj[date].totalClassificationReviewedFiles) {
                    classificationAcc = ((finalFormattedDataObj[date].reviewedClassificationCorrect * 100) / finalFormattedDataObj[date].totalClassificationReviewedFiles).toFixed(2)
                }
                let extractAcc = 0
                if (finalFormattedDataObj[date].totalExtractionReviewedDocs) {
                    extractAcc = ((finalFormattedDataObj[date].reviewedExtractionCorrect * 100) / finalFormattedDataObj[date].totalExtractionReviewedDocs).toFixed(2)
                }
                finalFormattedDataObj[date].classificationAcc = classificationAcc
                finalFormattedDataObj[date].extractAcc = extractAcc
            }
            // console.log("finalFormattedDataObj", finalFormattedDataObj)
            cb();
        }],
    }, err => {
        if (err) {
            callback(err);
        } else {
            let html = ""
            for (const date in finalFormattedDataObj) {
                // console.log("date, finalFormattedDataObj:::", date, finalFormattedDataObj)
                html = `Daily Stats : <br>
                    <br>Total Uploaded Files: ${finalFormattedDataObj[date].totalUploadedFiles || 0}<br>
                    <br>Total Docs: ${finalFormattedDataObj[date].totalUploadedDocs || 0}<br>
                    <br>Total AI Invoices: ${finalFormattedDataObj[date].totalUploadedInvoices || 0}<br>
                    <br>Total Invoice Pages: ${finalFormattedDataObj[date].totalUploadedInvoicesPages || 0}<br>
                    <br>Total Invoice Extracted Pages: ${finalFormattedDataObj[date].totalExtractedPages || 0}<br>
                    <br><br>Total File Pages: ${finalFormattedDataObj[date].totalUploadedFilePages || 0}<br>
                    <br>Total Reviewed Invoices: ${finalFormattedDataObj[date].totalExtractionReviewedDocs || 0}<br>
                    <br>Total AI Correct Invoices: ${finalFormattedDataObj[date].reviewedExtractionCorrect || 0}<br>
                    <br>Total Classified Files: ${finalFormattedDataObj[date].totalClassificationReviewedFiles || 0}<br>
                    <br>Total AI Correct Classified Files: ${finalFormattedDataObj[date].reviewedClassificationCorrect || 0}<br>
                    <br>Classification Accuracy: ${finalFormattedDataObj[date].classificationAcc || 0}%<br>
                    <br>Extraction Accuracy: ${finalFormattedDataObj[date].extractAcc || 0}%<br>`
            }
            // console.log("html::::::", html)
            ImcAPIEndPoints.sendEmail({
                subject: `IDP Daily Stats ${payload.subTime || ""} | Report Date: ${payload.date} `,
                body: html,
                apiTarget: 'REPORTS'
            }).then(() => {
                callback(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT
                })
            }).catch((e) => { callback(e) });
        }
    })
}

const generateDailyReports = ({ name, tenantId, time }, callback) => {
    let startDate = moment().subtract(2, 'day').tz(TIME_ZONE).format("DD-MM-YYYY");
    const startMonthDate = moment(startDate, 'DD-MM-YYYY').startOf('month').add(1, 'day').tz(TIME_ZONE)
        .format("DD-MM-YYYY");
    let endDate = startDate
    if (time && time === "8PM") {
        startDate = moment().tz(TIME_ZONE).format("DD-MM-YYYY");
        endDate = startDate
    }
    const sendResponseAsJson = false
    const sendCombinedMail = true
    const payload = {
        startDate,
        endDate,
        sendResponseAsJson,
        sendCombinedMail
    }
    const mtdPayload = {
        startMonthDate,
        endDate,
        sendResponseAsJson,
        sendCombinedMail
    }
    // console.log("name, tenantid:", name, tenantId)
    async.auto({
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = createMongooseId(res._id)
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                tenantId = createMongooseId(tenantId)
                cb()
            }
        },
        generateDocLifeCycleReport: ["getTenantId", (res, cb) => {
            // if (time && time === "8PM") {
            //     return cb()
            // }
            getDocLifecycleReport({ name: "SYSTEM", tenantId }, payload, (err, res) => {
                if (err) {
                    console.log("docLifeCycleReport err:", err)
                    return cb(err)
                }
                // console.log("COMPLETED DOC LIFECYCLE")
                cb(null, res)
            })
        }],
        generateClassificationReports: ["generateDocLifeCycleReport", (res, cb) => {
            getClassificationReport({ name: "SYSTEM", tenantId, time }, payload, (err, res) => {
                if (err) {
                    console.log("getClassificationReport err:", err)
                    return cb(err)
                }
                // console.log("COMPLETED CLASSIFICATION")
                cb(null, res)
            })
        }],
        generateExtractionReport: ["generateClassificationReports", (res, cb) => {
            getExtractionReport({ name: "SYSTEM", tenantId, time }, payload, (err, res) => {
                if (err) {
                    console.log("getExtractionReport err:", err)
                    return cb(err)
                }
                // console.log("COMPLETED EXTRACTION")
                cb(null, res)
            })
        }],
        generateMTDReport: ["generateExtractionReport", (res, cb) => {
            // if (time && time === "8PM") {
            //     return cb()
            // }
            getMTDReport({ name: "SYSTEM", tenantId }, mtdPayload, (err, res) => {
                if (err) {
                    console.log("getMTDReport err:", err)
                    return cb(err)
                }
                // console.log("COMPLETED MTD")
                cb(null, res)
            })
        }],
        queueLogsReport: ["generateExtractionReport", (res, cb) => {
            // if (time && time === "8PM") {
            //     return cb()
            // }
            queueLogsReport({ name: "SYSTEM", tenantId }, payload, (err, res) => {
                if (err) {
                    console.log("queueLogsReport err:", err)
                    return cb(err)
                }
                // console.log("COMPLETED MTD")
                cb(null, res.data)
            })
        }],
    }, (err, res) => {
        // console.log("res:::", res)
        if (err) {
            console.log("final err::::", err)
            return callback(err);
        }
        console.log("not in error")
        let html = `Please find the links of the reports: <br><br>
                    ${res.generateDocLifeCycleReport || ""}<br>
                    ${res.generateClassificationReports || ""}<br>
                    ${res.generateExtractionReport || ""}<br>
                    ${res.generateMTDReport || ""}<br>`
        // console.log(html)
        if (time === "8PM") {
            html = `Please find the links of the reports: <br><br>
            ${res.generateDocLifeCycleReport || ""}<br>
            ${res.generateClassificationReports || ""}<br>
            ${res.generateExtractionReport || ""}<br>
            ${res.generateMTDReport || ""}<br>
            ${res.queueLogsReport || ""}<br>`
        }
        ImcAPIEndPoints.sendEmail({
            subject: `IDP Daily Reports ${time} | Report Date: ${payload.startDate} - ${payload.endDate} `,
            body: html,
            apiTarget: 'REPORTS'
        }).then(() => {
            callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT
            })
        }).catch((e) => { callback(e) });
    })
}
const getReportsList = ({ id, tenantId }, { reportType = null, pageNo = 1, limit = 10, orderBy = 'DESC', sortBy = 'createdAt' }, callback) => {
    console.log("getReportsList id, tenantid:", id, tenantId)
    const criteria = { tenantId }
    if (reportType && reportType !== "ALL") {
        criteria.reportType = reportType
    }
    console.log("getReportsList criteria::", criteria)
    const sortObj = {
        [sortBy]: orderBy === "DESC" ? -1 : 1
    }
    let totalCount = 0
    const startIndex = (pageNo - 1) * limit
    // console.log("sortObj:::", sortObj)
    // console.log("startIndex, limit, sortObj", startIndex, limit, sortObj)
    async.auto({
        getTotalCount: (cb) => {
            reportsListService.count(criteria, (err, res) => {
                if (err) {
                    console.log(err)
                    return cb(err)
                }
                console.log("reportListService.count res", res)
                totalCount = res
                cb()
            })
        },
        getReportsList: ['getTotalCount', (res, cb) => {
            reportsListService.findAll(criteria, {}, { lean: true, sort: sortObj, skip: startIndex, limit }, (err, res) => {
                if (err) {
                    console.log(err)
                    return cb(err)
                }
                // console.log("reportListService res", res)
                cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    totalCount,
                    data: res
                })
            })
        }],
    }, (err, res) => {
        // console.log("res:::", res)
        if (err) {
            return callback(err);
        }
        callback(null, res.getReportsList)
    })
}
const downloadReport = (payload, callback) => {
    const filePath = `${FINAL_REPORT_DIR}${payload.fileName}`;
    if (fs.existsSync(filePath)) {
        callback(null, {
            filePath,
            fileName: payload.fileName,
        });
    } else {
        callback(HTTP_ERROR_MESSAGES.FILE_UPLOAD.FILE_NOT_FOUND);
    }
};
const getExtractionReportBackup = ({ id, name, tenantId, time, email }, payload, callback) => {
    console.log("payloadddd getExtractionReport::::", payload)
    console.log("reports tenantId ::::", tenantId)
    if (payload.idpId) {
        // proceed
    } else if (payload.startDate && payload.endDate) {
        // proceed
    } else {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "idpId or start and end date required" });
    }
    const startDate = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString()
    let endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
    if (time && time === "8PM") {
        endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).hours(19).startOf('hour').toISOString()
        console.log("8PM endDate::", endDate)
    }
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE)
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE)
    const dateRangeInDays = date2.diff(date1, "days");
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    let documentsArray = [];
    const roles = {};
    const customersTeam = {};
    let formattedDataArray = [];
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    let reportId = null
    let userName = name
    const { tenantName = "mark_buckley" } = payload
    async.auto({
        getUserName: (cb) => {
            if (!name) {
                userService.findOne({ _id: id }, { firstName: 1 }, { lean: true }, null, (err, res) => {
                    if (err) {
                        console.error("userService err:", err)
                        return cb(err)
                    }
                    if (res) {
                        userName = res.firstName
                    }
                    cb()
                })
            } else {
                cb()
            }
        },
        insertIntoReportList: ["getUserName", (res, cb) => {
            const dataToInsert = {
                createdByUser: userName || email,
                reportName: `EXTRACTION_REPORT_BACKUP${payload.startDate}-${payload.endDate}`,
                status: "PENDING",
                tenantId,
                reportType: "EXTRACTION",
                isDownloaded: false,
                reportLinks: []
            }
            reportsListService.create(dataToInsert, (err, res) => {
                if (err) {
                    console.error("reportsListService.create err:", err)
                    return cb(err)
                }
                reportId = res._id
                console.log("EXTRACTION_REPORT successfully inserted into reportlist")
                cb()
            })
        }],
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name: tenantName }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = res._id
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                cb()
            }
        },
        getTicketData: ['getTenantId', (_, cb) => {
            let criteria = {
                "batch.createdAt": {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                },
                // qcStatus: { $in: ["COMPLETED", "ASSIGNED_SUPERVISOR"] },
                // docType: "Invoices Custom"
            };
            if (payload.idpId) {
                criteria = { idpId: payload.idpId }
            }
            const projection = {
                documents: 1,
                idpId: 1
            };
            const option = {
                lean: true
            };
            console.log("criteria: ", criteria)
            IDP_BACKUP.find(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("result::::", result)
                    documentsArray = result || [];
                    // console.log("criteria:::", criteria, documentsArray)
                    cb();
                }
            })
        }],
        getRolesData: ['getTicketData', (res, cb) => {
            roleService.findAll({}, { role: 1, _id: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("roleService.findAll err:", err);
                    cb(err);
                } else {
                    for (const role in result) {
                        roles[role._id] = role
                    }
                    cb();
                }
            })
        }],
        getCustomersData: ['getRolesData', (res, cb) => {
            customersService.findAll({ tenantId }, { teamName: 1, customersArray: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("customersService.findAll err:", err);
                    cb(err);
                } else {
                    for (const team in result) {
                        for (const customer in team.customersArray) {
                            if (!(customer in customersTeam)) {
                                customersTeam[customer] = team.teamName
                            }
                        }
                    }
                    // console.log("customerTeam:::", customersTeam)
                    cb();
                }
            })
        }],
        formatData: ['getCustomersData', (res, cb) => {
            if (!documentsArray.length) {
                console.log("no documents found in db")
                return cb();
            }
            let srNo = 0
            documentsArray.forEach(({ documents = [] }) => {
                for (const document of documents) {
                    const pageDetails = {}
                    let isPageRotated = false
                    let strategyChanged = false
                    if (document.pageArray) {
                        for (const page of document.pageArray) {
                            if (page.sumRotateByDegree && page.sumRotateByDegree !== 0) {
                                isPageRotated = true
                            }
                            if (Array.isArray(page.ocrStrategy) && (page.ocrStrategy.includes("A") || page.ocrStrategy.includes("B") || page.ocrStrategy.includes("C"))) {
                                strategyChanged = true
                            }
                            for (const content of page.nonTabularContent) {
                                if (!(content.global_key in pageDetails)) {
                                    pageDetails[content.global_key] = {
                                        edited_value: content.local_value.edited_value,
                                        text: content.local_value.text
                                    }
                                }
                            }
                        }
                    }
                    if ("docType" in document && document.docType !== '#NEW_FORMAT#') {
                        srNo += 1
                        let pageRange = document.pageRange && document.pageRange.split(",")
                        if (pageRange && pageRange.length) {
                            const firstPage = pageRange[0]
                            const lastPage = pageRange[pageRange.length - 1]
                            pageRange = `${firstPage}-${lastPage}`
                            if (firstPage === lastPage) {
                                pageRange = `${firstPage}`
                            }
                        } else {
                            pageRange = ''
                        }

                        const formattedObj = {
                            "Sr No": srNo.toString(),
                            "Customer Id": document.externalCustomerId || "NA",
                            "Vendor Id": (document.mapping && document.mapping["Vendor ID"]) || "NA",
                            "Upload Date": document.createdAt ? moment(document.createdAt).tz('America/Chicago').format('DD-MM-YYYY') : "NA",
                            "Upload Time": document.createdAt ? moment(document.createdAt).tz('America/Chicago').format('HH:mm:ss') : "NA",
                            "AI Process Request Time": document.ocrRequestTime ? moment(document.ocrRequestTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                            "AI Process Response Time": document.ocrResponseTime ? moment(document.ocrResponseTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                            "Indexer Review Date and time": document.reviewedAt ? moment(document.reviewedAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                            "External Batch Id": (document.external && document.external.batchId) || "NA",
                            "File Name": document.fileOriginalName || "NA",
                            "Doc Id": (document.external && document.external.docId) || "NA",
                            "AI Unique Id": document.aiUniqueId || "NA",
                            "AI Doc Type": document.aiDocType || "NA",
                            "Rev Doc Type": document.docType || "NA",
                            "Is Page Rotated": isPageRotated ? "YES" : "NO",
                            "AI Invoice Number": (pageDetails["Invoice Number"] && pageDetails["Invoice Number"].text !== null) ? pageDetails["Invoice Number"].text : "NULL",
                            "Rev Invoice Number": (pageDetails["Invoice Number"] && pageDetails["Invoice Number"].edited_value !== null) ? pageDetails["Invoice Number"].edited_value : "NULL",
                            "AI Invoice Date": (pageDetails["Invoice Date"] && pageDetails["Invoice Date"].text !== null) ? pageDetails["Invoice Date"].text : "NULL",
                            "Rev Invoice Date": (pageDetails["Invoice Date"] && pageDetails["Invoice Date"].edited_value !== null) ? pageDetails["Invoice Date"].edited_value : "NULL",
                            "AI PO Number": (pageDetails["Purchase Order Number"] && pageDetails["Purchase Order Number"].text !== null) ? pageDetails["Purchase Order Number"].text : "NULL",
                            "Rev PO Number": (pageDetails["Purchase Order Number"] && pageDetails["Purchase Order Number"].edited_value !== null) ? pageDetails["Purchase Order Number"].edited_value : "NULL",
                            "AI PO Date": (pageDetails["Purchase Order Date"] && pageDetails["Purchase Order Date"].text !== null) ? pageDetails["Purchase Order Date"].text : "NULL",
                            "Rev PO Date": (pageDetails["Purchase Order Date"] && pageDetails["Purchase Order Date"].edited_value !== null) ? pageDetails["Purchase Order Date"].edited_value : "NULL",
                            "AI Invoice Amount": (pageDetails["Total Invoice Amount"] && pageDetails["Total Invoice Amount"].text !== null) ? pageDetails["Total Invoice Amount"].text : "NULL",
                            "Rev Invoice Amount": (pageDetails["Total Invoice Amount"] && pageDetails["Total Invoice Amount"].edited_value !== null) ? pageDetails["Total Invoice Amount"].edited_value : "NULL",
                            "AI Total Tax Amount": (pageDetails["Total Tax Amount"] && pageDetails["Total Tax Amount"].text !== null) ? pageDetails["Total Tax Amount"].text : "NULL",
                            "Rev Total Tax Amount": (pageDetails["Total Tax Amount"] && pageDetails["Total Tax Amount"].edited_value !== null) ? pageDetails["Total Tax Amount"].edited_value : "NULL",
                            "AI Invoice SubTotal": (pageDetails["Invoice Sub Total"] && pageDetails["Invoice Sub Total"].text !== null) ? pageDetails["Invoice Sub Total"].text : "NULL",
                            "Rev Invoice SubTotal": (pageDetails["Invoice Sub Total"] && pageDetails["Invoice Sub Total"].edited_value !== null) ? pageDetails["Invoice Sub Total"].edited_value : "NULL",
                            "AI Invoice Freight": (pageDetails["Invoice Freight"] && pageDetails["Invoice Freight"].text !== null) ? pageDetails["Invoice Freight"].text : "NULL",
                            "Rev Invoice Freight": (pageDetails["Invoice Freight"] && pageDetails["Invoice Freight"].edited_value !== null) ? pageDetails["Invoice Freight"].edited_value : "NULL",
                            "AI Supplier Name": (pageDetails["Vendor Name"] && pageDetails["Vendor Name"].text !== null) ? pageDetails["Vendor Name"].text : "NULL",
                            "Rev Supplier Name": (pageDetails["Vendor Name"] && pageDetails["Vendor Name"].edited_value !== null) ? pageDetails["Vendor Name"].edited_value : "NULL",
                            "AI Supplier Address": (pageDetails["Vendor Address"] && pageDetails["Vendor Address"].text !== null) ? pageDetails["Vendor Address"].text : "NULL",
                            "Rev Supplier Address": (pageDetails["Vendor Address"] && pageDetails["Vendor Address"].edited_value !== null) ? pageDetails["Vendor Address"].edited_value : "NULL",
                            "AI Supplier Reg Number": (pageDetails["Vendor Registration Number"] && pageDetails["Vendor Registration Number"].text !== null) ? pageDetails["Vendor Registration Number"].text : "NULL",
                            "Rev Supplier Reg Number": (pageDetails["Vendor Registration Number"] && pageDetails["Vendor Registration Number"].edited_value !== null) ? pageDetails["Vendor Registration Number"].edited_value : "NULL",
                            "AI Account Number": (pageDetails["Account Number"] && pageDetails["Account Number"].text !== null) ? pageDetails["Account Number"].text : "NULL",
                            "Rev Account Number": (pageDetails["Account Number"] && pageDetails["Account Number"].edited_value !== null) ? pageDetails["Account Number"].edited_value : "NULL",
                            "AI Job Number": (pageDetails["Job Number"] && pageDetails["Job Number"].text !== null) ? pageDetails["Job Number"].text : "NULL",
                            "Rev Job Number": (pageDetails["Job Number"] && pageDetails["Job Number"].edited_value !== null) ? pageDetails["Job Number"].edited_value : "NULL",
                            "AI Loan Number": (pageDetails["Loan Number"] && pageDetails["Loan Number"].text !== null) ? pageDetails["Loan Number"].text : "NULL",
                            "Rev Loan Number": (pageDetails["Loan Number"] && pageDetails["Loan Number"].edited_value !== null) ? pageDetails["Loan Number"].edited_value : "NULL",
                            "AI Sub Contract Number": (pageDetails["Sub Contract Number"] && pageDetails["Sub Contract Number"].text !== null) ? pageDetails["Sub Contract Number"].text : "NULL",
                            "Rev Sub Contract Number": (pageDetails["Sub Contract Number"] && pageDetails["Sub Contract Number"].edited_value !== null) ? pageDetails["Sub Contract Number"].edited_value : "NULL",
                            "KV request": document.keyExtractRequestTime ? moment(document.keyExtractRequestTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                            "KV response": document.keyExtractResponseTime ? moment(document.keyExtractResponseTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                            "Ocr Strategy changed ": strategyChanged ? "YES" : "NO",
                            "Batch Id": document.idpId && document.idpId.toString(),
                            "Page Range": pageRange
                        }
                        formattedDataArray.push(formattedObj);
                    }
                }
            })
            // console.log("formattedDataArray::::", formattedDataArray)
            cb();
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
                console.log("TOTAL CHUNKS OF EXTRACTION REPORT:", formattedDataArray.length);
            }
            cb();
        }],

        createXls: ['splitData', (res, cb) => {
            if (!payload.sendResponseAsJson) {
                if (formattedDataArray.length === 0) return cb();

                console.log("INSIDE CREATE XLS:", formattedDataArray.length);
                async.forEachOf(formattedDataArray, async (formattedChunkArray, key) => {
                    console.log("SUBARRAY LENGTH:", formattedChunkArray.length, "KEY:", key);
                    try {
                        const options = {
                            output: 'binary',
                            nodeExcel: {}
                        };

                        const xlsBinary = await json2xlsAsync(formattedChunkArray, options);
                        const fileName = `IDP_EXTRACTION_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR EXTRACTION_REPORT:", filePath);

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
            if (!payload.sendResponseAsJson) {
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
            } else {
                cb()
            }
        }],

        sendEmail: ['sendFileToServer', 'insertIntoReportList', (res, cb) => {
            // return cb()
            if (!payload.sendResponseAsJson) {
                const dataToSend = {
                    subject: `IDP Extraction Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                    html: '',
                    // notificationType: "idp_backend_report",
                    // attachmentNames: [],
                    // triggerNow: true
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
                        if (newFileName) {
                            reportLinkString += `${i.toString()}. https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}<br><br>`;
                            reportsLinksArray.push(`https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}`)
                        }
                    }
                    dataToSend.html = `Please find the report in the links below: <br>${reportLinkString}`;
                }
                if (payload.sendCombinedMail) {
                    if (reportLinkString) {
                        return cb(null, reportLinkString)
                    }
                    return cb(null, "No Data Found to create report - Extraction report BACKUp")
                }
                ImcAPIEndPoints.sendEmail({
                    subject: dataToSend.subject,
                    body: dataToSend.html,
                    apiTarget: 'REPORTS'
                }).then(() => { cb() }).catch((e) => { cb(e) });
            } else {
                cb()
            }
        }],
        updateReportsListDB: ['sendEmail', (res, cb) => {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "COMPLETED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (err) => {
                if (err) {
                    console.error("reportsListService.update err", err)
                    return cb(err)
                }
                console.log("EXTRACTION_REPORT successfully updated into reportlist")
                cb()
            })
        }]
    }, (err, res) => {
        // console.log("mtd res::::", res)
        if (err) {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "FAILED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (error) => {
                if (error) {
                    console.erroror("reportsListService.update err", error)
                }
                console.log("EXTRACTION_REPORT successfully updated into reportlist in err")
                callback(err);
            })
        } else {
            // if (payload.sendCombinedMail) {
            //     return callback(null, res.sendEmail)
            // }
            if (!payload.sendResponseAsJson) {
                return callback(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    message: "Request accepted, proccessing the report.",
                    data: reportsLinksArray
                });
            }
            return callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                data: formattedDataArray
            })
        }
    })
}

/**
 * extraction report new
 * @param {*} param0
 * @param {*} payload
 * @param {*} callback
 * @returns
 */
const getExtractionReportNew = ({ id, name, tenantId, time, email }, payload, callback) => {
    console.log("payloadddd getExtractionReport::::", payload)
    console.log("reports tenantId ::::", tenantId)
    const startDate = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE).startOf('day').toISOString()
    let endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).endOf('day').toISOString()
    if (time && time === "8PM") {
        endDate = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE).hours(19).startOf('hour').toISOString()
        console.log("8PM endDate::", endDate)
    }
    const date1 = moment.tz(payload.startDate, "DD-MM-YYYY", TIME_ZONE)
    const date2 = moment.tz(payload.endDate, "DD-MM-YYYY", TIME_ZONE)
    const dateRangeInDays = date2.diff(date1, "days");
    if (dateRangeInDays > 31) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Date range greater than 1 month not allowed" });
    }
    let documentsArray = [];
    const roles = {};
    const customersTeam = {};
    let formattedDataArray = [];
    const filePathArray = [];
    const reportsLinksArray = []
    const reportsDownloadLinksArray = []
    let reportId = null
    let userName = name
    const { tenantName = "mark_buckley" } = payload
    async.auto({
        getUserName: (cb) => {
            if (!name) {
                userService.findOne({ _id: id }, { firstName: 1 }, { lean: true }, null, (err, res) => {
                    if (err) {
                        console.error("userService err:", err)
                        return cb(err)
                    }
                    if (res) {
                        userName = res.firstName
                    }
                    cb()
                })
            } else {
                cb()
            }
        },
        insertIntoReportList: ["getUserName", (res, cb) => {
            const dataToInsert = {
                createdByUser: userName || email,
                reportName: `EXTRACTION_REPORT_${payload.startDate}-${payload.endDate}`,
                status: "PENDING",
                tenantId,
                reportType: "EXTRACTION",
                isDownloaded: false,
                reportLinks: []
            }
            reportsListService.create(dataToInsert, (err, res) => {
                if (err) {
                    console.error("reportsListService.create err:", err)
                    return cb(err)
                }
                reportId = res._id
                console.log("EXTRACTION_REPORT successfully inserted into reportlist")
                cb()
            })
        }],
        getTenantId: (cb) => {
            if (!tenantId) {
                tenantService.findOne({ name: tenantName }, { name: 1, _id: 1 }, (err, res) => {
                    if (err) {
                        cb(err, null)
                    }
                    tenantId = res._id
                    console.log(name, "- tenantId -", tenantId)
                    cb()
                });
            } else {
                cb()
            }
        },
        getTicketData: ['getTenantId', (_, cb) => {
            const criteria = {
                reviewedAt: {
                    $gte: startDate,
                    $lte: endDate
                },
                tenantId,
                qcStatus: { $in: ["COMPLETED", "ASSIGNED_SUPERVISOR"] },
                docType: "Invoices Custom"
            };
            if (payload.docType) {
                criteria.docType = payload.docType
            }
            const projection = {
                externalCustomerId: 1,
                mapping: 1,
                createdAt: 1,
                fileOriginalName: 1,
                ocrRequestTime: 1,
                ocrResponseTime: 1,
                reviewedAt: 1,
                external: 1,
                aiUniqueId: 1,
                aiDocType: 1,
                docType: 1,
                pageArray: 1,
                keyExtractRequestTime: 1,
                keyExtractResponseTime: 1,
                idpId: 1,
                pageRange: 1,
                filesMerged: 1,
                uploadedDocType: 1
            };
            const option = {
                lean: true
            };

            documentService.findAll(criteria, projection, option, (err, result) => {
                if (err) {
                    console.error("documentService.findAll err:", err);
                    cb(err);
                } else {
                    // console.log("result::::", result)
                    documentsArray = result || [];
                    // console.log("criteria:::", criteria, documentsArray)
                    cb();
                }
            })
        }],
        findLatestPages: ['getTicketData', (_, cb) => {
            async.eachLimit(documentsArray, 10, (doc, ecb) => {
                if (doc.pageArray && doc.pageArray[0]) {
                    return ecb() // old document
                }
                // new document
                PAGE.find({ documentId: doc._id }).lean().exec((e, pages) => {
                    if (pages && pages[0]) {
                        doc.pageArray = pages
                    }
                    ecb()
                })
            }, cb)
        }],
        getRolesData: ['getTicketData', (res, cb) => {
            roleService.findAll({}, { role: 1, _id: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("roleService.findAll err:", err);
                    cb(err);
                } else {
                    for (const role in result) {
                        roles[role._id] = role
                    }
                    cb();
                }
            })
        }],
        getCustomersData: ['getRolesData', (res, cb) => {
            customersService.findAll({ tenantId }, { teamName: 1, customersArray: 1 }, { lean: true }, (err, result) => {
                if (err) {
                    console.error("customersService.findAll err:", err);
                    cb(err);
                } else {
                    for (const team in result) {
                        for (const customer in team.customersArray) {
                            if (!(customer in customersTeam)) {
                                customersTeam[customer] = team.teamName
                            }
                        }
                    }
                    // console.log("customerTeam:::", customersTeam)
                    cb();
                }
            })
        }],
        formatData: ['getCustomersData', 'findLatestPages', (res, cb) => {
            if (!documentsArray.length) {
                console.log("no documents found in db")
                return cb();
            }
            let srNo = 0
            formattedDataArray.push({
                "Sr No": '',
                "Customer Id": "",
                "Vendor Id": '',
                "Upload Date": '',
                "Upload Time": '',
                "AI Process Request Time": '',
                "AI Process Response Time": '',
                "Indexer Review Date and time": '',
                "External Batch Id": '',
                "File Name": '',
                "Doc Id": '',
                "AI Unique Id": '',
                "AI Doc Type": '',
                "Rev Doc Type": '',
                "Is Page Rotated": '',
                "KV request": '',
                "KV response": '',
                "Ocr Strategy changed ": '',
                "Batch Id": '',
                "Page Range": '',
                "filesMerged": '',
                "Uploaded Doc Type": ''
            })
            for (const document of documentsArray) {
                const pageDetails = {}
                const pageDetailsFeedBack = {}

                let isPageRotated = false
                let strategyChanged = false
                if (document.pageArray) {
                    for (const page of document.pageArray) {
                        if (page.sumRotateByDegree && page.sumRotateByDegree !== 0) {
                            isPageRotated = true
                        }
                        if (Array.isArray(page.ocrStrategy) && (page.ocrStrategy.includes("A") || page.ocrStrategy.includes("B") || page.ocrStrategy.includes("C"))) {
                            strategyChanged = true
                        }
                        for (const content of page.nonTabularContent) {
                            formattedDataArray[0][`AI ${content.global_key}`] = ''
                            formattedDataArray[0][`REV ${content.global_key}`] = ''
                            formattedDataArray[0][`${content.global_key} Feedback Applied`] = ''
                            if (!(content.global_key in pageDetails)) {
                                pageDetails[`AI ${content.global_key}`] = content.local_value.text || "NULL"
                                pageDetails[`REV ${content.global_key}`] = content.local_value.edited_value || "NULL"
                            }
                            if (content.global_key) {
                                pageDetailsFeedBack[`${content.global_key} Feedback Applied`] = content['feedback_applied'] ? "YES" : "NO"
                            }
                        }
                        for (const content of page.tabularContent) {
                            // TODO table content feedback applied
                            // if (!(content.global_key in pageDetailsFeedBack)) {
                            //     pageDetailsFeedBack[`${content.global_key} Feedback Applied`] = content['feedback_applied']
                            // }
                        }
                    }
                }
                if ("docType" in document && document.docType !== '#NEW_FORMAT#') {
                    srNo += 1
                    let pageRange = document.pageRange && document.pageRange.split(",")
                    if (pageRange && pageRange.length) {
                        const firstPage = pageRange[0]
                        const lastPage = pageRange[pageRange.length - 1]
                        pageRange = `${firstPage}-${lastPage}`
                        if (firstPage === lastPage) {
                            pageRange = `${firstPage}`
                        }
                    } else {
                        pageRange = ''
                    }
                    console.log("pageDetailsFeedBackpageDetailsFeedBack:", pageDetailsFeedBack)
                    const formattedObj = {
                        "Sr No": srNo.toString(),
                        "Customer Id": document.externalCustomerId || "NA",
                        "Vendor Id": (document.mapping && document.mapping["Vendor ID"]) || "NA",
                        "Upload Date": document.createdAt ? moment(document.createdAt).tz('America/Chicago').format('DD-MM-YYYY') : "NA",
                        "Upload Time": document.createdAt ? moment(document.createdAt).tz('America/Chicago').format('HH:mm:ss') : "NA",
                        "AI Process Request Time": document.ocrRequestTime ? moment(document.ocrRequestTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "AI Process Response Time": document.ocrResponseTime ? moment(document.ocrResponseTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "Indexer Review Date and time": document.reviewedAt ? moment(document.reviewedAt).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "External Batch Id": (document.external && document.external.batchId) || "NA",
                        "File Name": document.fileOriginalName || "NA",
                        "Doc Id": (document.external && document.external.docId) || "NA",
                        "AI Unique Id": document.aiUniqueId || "NA",
                        "AI Doc Type": document.aiDocType || "NA",
                        "Rev Doc Type": document.docType || "NA",
                        "Is Page Rotated": isPageRotated ? "YES" : "NO",
                        "KV request": document.keyExtractRequestTime ? moment(document.keyExtractRequestTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "KV response": document.keyExtractResponseTime ? moment(document.keyExtractResponseTime).tz('America/Chicago').format('DD-MM-YYYY HH:mm:ss') : "NA",
                        "Ocr Strategy changed ": strategyChanged ? "YES" : "NO",
                        "Batch Id": document.idpId && document.idpId.toString(),
                        "Page Range": pageRange,
                        "filesMerged": (document.filesMerged && document.filesMerged.map(f => f.fileOriginalName).join()) || '',
                        "Uploaded Doc Type": document.uploadedDocType || "Invoices Custom",
                        ...pageDetails,
                        ...pageDetailsFeedBack
                    }
                    formattedDataArray.push(formattedObj);
                }
            }
            // console.log("formattedDataArray::::", formattedDataArray)
            cb();
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
                console.log("TOTAL CHUNKS OF EXTRACTION REPORT:", formattedDataArray.length);
            }
            cb();
        }],

        createXls: ['splitData', (res, cb) => {
            if (!payload.sendResponseAsJson) {
                if (formattedDataArray.length === 0) return cb();

                console.log("INSIDE CREATE XLS:", formattedDataArray.length);
                async.forEachOf(formattedDataArray, async (formattedChunkArray, key) => {
                    console.log("SUBARRAY LENGTH:", formattedChunkArray.length, "KEY:", key);
                    try {
                        const options = {
                            output: 'binary',
                            nodeExcel: {}
                        };

                        const xlsBinary = await json2xlsAsync(formattedChunkArray, options);
                        const fileName = `IDP_EXTRACTION_REPORT_${process.env.NODE_ENV_LABEL}_${payload.startDate}-${payload.endDate}_${new Date().toISOString()}_part_${key + 1}.xlsx`;
                        const filePath = `${FINAL_REPORT_DIR}${fileName}`;

                        await fsXtra.ensureDir(FINAL_REPORT_DIR);
                        await fsPromise.writeFile(filePath, xlsBinary, 'binary');

                        console.log("NEW FILE CREATED FOR EXTRACTION_REPORT:", filePath);

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
            if (!payload.sendResponseAsJson) {
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
            } else {
                cb()
            }
        }],

        sendEmail: ['sendFileToServer', 'insertIntoReportList', (res, cb) => {
            // return cb()
            if (!payload.sendResponseAsJson) {
                const dataToSend = {
                    subject: `IDP Extraction Report | Report Date: ${payload.startDate} to ${payload.endDate}`,
                    html: '',
                    // notificationType: "idp_backend_report",
                    // attachmentNames: [],
                    // triggerNow: true
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
                        if (newFileName) {
                            reportLinkString += `${i.toString()}. https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}<br><br>`;
                            reportsLinksArray.push(`https://storage.amygbserver.in/getAuthenticatedFile/${newFileName}`)
                        }
                    }
                    dataToSend.html = `Please find the report in the links below: <br>${reportLinkString}`;
                }
                if (payload.sendCombinedMail) {
                    if (reportLinkString) {
                        return cb(null, reportLinkString)
                    }
                    return cb(null, "No Data Found to create report - Extraction report")
                }
                ImcAPIEndPoints.sendEmail({
                    subject: dataToSend.subject,
                    body: dataToSend.html,
                    apiTarget: 'REPORTS'
                }).then(() => { cb() }).catch((e) => { cb(e) });
            } else {
                cb()
            }
        }],
        updateReportsListDB: ['sendEmail', (res, cb) => {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "COMPLETED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (err) => {
                if (err) {
                    console.error("reportsListService.update err", err)
                    return cb(err)
                }
                console.log("EXTRACTION_REPORT successfully updated into reportlist")
                cb()
            })
        }]
    }, (err, res) => {
        // console.log("mtd res::::", res)
        if (err) {
            const dataToSet = {
                reportLinks: reportsDownloadLinksArray,
                status: "FAILED"
            }
            reportsListService.update({ _id: reportId }, { $set: dataToSet }, { lean: true }, (error) => {
                if (error) {
                    console.erroror("reportsListService.update err", error)
                }
                console.log("EXTRACTION_REPORT successfully updated into reportlist in err")
                callback(err);
            })
        } else {
            if (payload.sendCombinedMail) {
                return callback(null, res.sendEmail)
            }
            if (!payload.sendResponseAsJson) {
                return callback(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    message: "Request accepted, proccessing the report."
                });
            }
            return callback(null, {
                ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                data: formattedDataArray
            })
        }
    })
}

module.exports = {
    getDocLifecycleReport,
    getClassificationReport,
    getExtractionReport: getExtractionReportNew,
    getMTDReport,
    generateDailyReports,
    getDailyStats,
    getReportsList,
    downloadReport,
    getExtractionReportBackup
};
