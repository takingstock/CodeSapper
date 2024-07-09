const config = require('config');
const { auto } = require('async');
const { documentService, idpService } = require('../Services');
const ImcAPIEndPoints = require('./imc-endpoints.util');
const { serverStatus } = require('./load-balancer');
const { lastUpdated } = require('../Controllers/admin-dashboard.controller')
const { getTimeDifferenceInSec } = require('./universal-functions.util');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

// let initialFileName = null;
// let fromDate = null;
const serverStartTime = new Date();
const thresholdTime = 15 * 60 * 1000
const serverThresholdTime = 30 * 60
const twoHourThreshold = 120 * 60
const oneHourThreshold = 60 * 60
let lastAlertSend15 = null;
let lastAlertSend30 = null;
let lastAlertSendTwo30 = null;
let lastAlertSendOneHour = null;
let lastAlertSendOneHour2 = null;
let lastAlertSendForOCR = null;
const startTime = '10:00:10';
const endTime = '21:00:00';
const sendAlertEmail = (object, callback) => {
    // console.log("INSIDE MAIL")
    // const html = `This alert was triggered because no files has been processed in the last 15 mins`
    // console.log(html)
    ImcAPIEndPoints.sendEmail({
        subject: object.subject,
        body: object.body,
        apiTarget: object.apiTarget
    }).then(() => {
        callback(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT
        })
    }).catch((e) => { callback(e) });
}

const checkServerRestarted = () => {
    console.log("Inside Restarted===>", process.env.NODE_ENV_LABEL)
    if (process.env.NODE_ENV_LABEL && process.env.NODE_ENV_LABEL === 'MARK_PROD') {
        console.log("Inside Restarted PROD ++++")
        const object = {
            subject: `Alert for Server Restarted `,
            body: `Dear Team <br>This alert was triggered because the server was restarted<br><br>Regards, <br>IDP Mailer`,
            apiTarget: 'PLATFORM'
        }
        sendAlertEmail(object, (err, res) => {
            console.log("restart email alert", err, res)
        })
    }
}
checkServerRestarted()

const checkTimeForScalar = (startTime, endTime) => {
    const currentDate = new Date()

    const startDate = new Date(currentDate.getTime());
    startDate.setHours(startTime.split(":")[0]);
    startDate.setMinutes(startTime.split(":")[1]);
    startDate.setSeconds(startTime.split(":")[2]);

    const endDate = new Date(currentDate.getTime());
    endDate.setHours(endTime.split(":")[0]);
    endDate.setMinutes(endTime.split(":")[1]);
    endDate.setSeconds(endTime.split(":")[2]);

    return startDate <= currentDate && endDate >= currentDate
}

const checkIfFileIsInQueue = (callback) => {
    let flag1 = false
    let flag2 = false
    auto({
        // if any file is pending or in queue, any time
        checkPendingFiles: (cb) => {
            /// count
            documentService.count({ aiStatus: 'OCR_PENDING' }, (err, res) => {
                if (err) {
                    console.error("err in checkPendingFiles", err)
                } else if (res && res > 0) {
                    flag1 = true
                }
                cb(err)
            })
        },
        checkOCRTime: ['checkPendingFiles', (res, cb) => {
            if (flag1 === true) {
                const time = new Date().getTime() - thresholdTime
                console.log("Time for checkOCRTime", time, new Date(time))
                documentService.count({ ocrResponseTime: { $gte: new Date(time) } }, (err, result) => {
                    if (err) {
                        console.error("err in checkOCRTime", err)
                    } else if (result && result === 0) {
                        flag2 = true
                    }
                    cb(err)
                })
            } else {
                cb()
            }
        }],
        sendEmailAlert: ['checkOCRTime', (res, cb) => {
            if (flag1 === true && flag2 === true) {
                lastAlertSend15 = new Date()
                const object = {
                    subject: `Alert for No file has been processed in 15min `,
                    body: `Dear Team <br>This alert was triggered because no file has been processed in the last 15 mins<br><br>Regards,<br>IDP Mailer`,
                    apiTarget: 'NEW_ALERTS'

                }
                sendAlertEmail(object, (err) => {
                    if (err) {
                        return callback(err) // console.error("sendAlertEmail err:", err);
                    }
                    // callback()
                })
            }
            cb()
        }]
    }, callback)
}
//  if the server is busy for more than half hr

const checkForServerBusy = (callback) => {
    Object.keys(serverStatus).forEach((key) => {
        // console.log("key---->", serverStatus[key])
        const value = serverStatus[key]
        // console.log("value---->", value)
        // if (lastAlertSend30 && getTimeDifferenceInSec(lastAlertSend30, new Date() < 30)) {
        //     return callback()
        // }
        if (value.currentStatus === 'BUSY' && (value.lastRequestSentAt && getTimeDifferenceInSec(value.lastRequestSentAt, new Date())) > serverThresholdTime) {
            // ipAddress = ele.ip
            lastAlertSend30 = new Date()
            console.log("INSIDE MAILER")
            const object = {
                subject: `Alert for server being busy for more than 30 mins`,
                body: `Dear Team <br>This alert was triggered because the ${value.ip} server has been busy for more than 30 mins <br><br>Regards, <br>IDP Mailer`,
                apiTarget: 'NEW_ALERTS'
            }
            sendAlertEmail(object, (err) => {
                if (err) {
                    // return callback(err)
                    console.error("sendAlertEmail err:", err);
                }
            })
        }
    })
    callback()
}

const checkServerBusyStatus = (callback) => {
    Object.keys(serverStatus).forEach((key) => {
        // console.log("key---->", serverStatus[key])
        const value = serverStatus[key]
        // console.log("value---->", value)
        const validServerStatus = ['BUSY', 'FREE']
        if (!(validServerStatus.includes(value.currentStatus))) {
            if (value.lastRequestSentAt && getTimeDifferenceInSec(value.lastRequestSentAt, new Date()) > serverThresholdTime) {
                // ipAddress = ele.ip
                lastAlertSendTwo30 = new Date()
                console.log("INSIDE MAILER")
                const object = {
                    subject: `Alert for one of the server status being other than BUSY/FREE for more than 30 mins`,
                    body: `Dear Team <br>This alert was triggered because the server ${value.ip} status being other than BUSY/FREE for more than 30 mins <br><br>Regards, <br>IDP Mailer`,
                    apiTarget: 'NEW_ALERTS'
                }
                sendAlertEmail(object, (err) => {
                    if (err) {
                        // return callback(err)
                        console.error("sendAlertEmail err:", err);
                    }
                })
            }
        }
    })
    callback()
}

const checkForOcrEnabledTime = (callback) => {
    if ((getTimeDifferenceInSec(process.env.KEY_VALUE_EXTRACT_OCR_LAST_ENABLED_AT, new Date()) > serverThresholdTime) && process.env.KEY_VALUE_EXTRACT_OCR === 'ENABLED') {
        console.log("INSIDE MAILER")
        lastAlertSendForOCR = new Date()
        const object = {
            subject: `Alert for KVP OCR ENABLED for more than 30 mins`,
            body: `Dear Team <br>This alert was triggered because KVP OCR is ENABLED for more than 30 mins<br><br>Regards, <br>IDP Mailer`,
            apiTarget: 'NEW_ALERTS'
        }
        sendAlertEmail(object, (err) => {
            if (err) {
                // return callback(err)
                console.error("sendAlertEmail err:", err);
            }
        })
    }
    callback()
}

const checkForLastUploadedFile = (callback) => {
    console.log("INNNNNNNN")
    // if (new Date().getTime() - serverStartTime.getTime() >= twoHourThreshold) {
    if (getTimeDifferenceInSec(serverStartTime, new Date()) >= twoHourThreshold) {
        auto({
            checkFiles: (cb) => {
                console.log("INNNNNNNN checkFiles")
                idpService.findAll({}, { createdAt: 1 }, { sort: { createdAt: -1 }, limit: 1 }, (err, result) => {
                    console.log("data Base all:::=== ", result && result[0])
                    // console.log("UPLOAD Diff:::==", getTimeDifferenceInSec(result[0].createdAt, new Date()), result[0].createdAt, new Date())
                    if (result && result[0]) {
                        lastAlertSendOneHour = result[0].createdAt
                        if (getTimeDifferenceInSec(result[0].createdAt, new Date()) > twoHourThreshold) {
                            console.log("ALERT SEND SUCCESSFULLy")
                            lastAlertSendOneHour = new Date();
                            const object = {
                                subject: `Alert for no files uploaded in the last 2 Hours `,
                                body: `Dear Team <br>This alert was triggered because no file has been uploaded in the last 2 Hours<br><br>Regards, <br>IDP Mailer`,
                                apiTarget: 'NEW_ALERTS'
                            }
                            sendAlertEmail(object, (err) => {
                                if (err) {
                                    return callback(err) // console.error("sendAlertEmail err:", err);
                                }
                            })
                        }
                        // console.log("DONEEE-->")
                    }
                    cb()
                })
            }
        }, callback)
    } else {
        callback()
    }
}
// if processing for AmyGB side is disabled for more than an hr

const checkIfDisabled = (callback) => {
    // console.log("lastUpdated===>", lastUpdated)
    if (process.env.FILE_OCR === "DISABLED" && (lastUpdated && getTimeDifferenceInSec(lastUpdated, new Date()) > oneHourThreshold)) {
       //  console.log("INSIDE FILE_OCR IF ---")
        lastAlertSendOneHour2 = new Date()
        const object = {
            subject: `Alert for AMYGB FILE_OCR Disabled for more than 1 hour `,
            body: `Dear Team <br>This alert was triggered because the Amygb File Ocr was Disabled for more than 1 hour<br><br>Regards, <br>IDP Mailer`,
            apiTarget: 'NEW_ALERTS'
        }
        sendAlertEmail(object, (err) => {
            if (err) {
                return callback(err)
            }
        })
    }
    // console.log("DONEEE 2-->")
    callback()
}
// const checkServerRestarted = () => {
//     console.log("Inside Restarted===>")
//     if (process.env.NODE_ENV_LABEL && process.env.NODE_ENV_LABEL.toUpperCase() === 'MARK_PROD') {
//         console.log("Inside Restarted PROD ++++")
//         const object = {
//             subject: `Alert for Server Restarted `,
//             body: `Dear Team <br>This alert was triggered because the server was restarted<br><br>Regards, <br>IDP Mailer`,
//             apiTarget: 'NEW_ALERTS'
//         }
//         // sendAlertEmail(object, () => {
//         //     console.log("restart email alert failed")
//         // })
//         sendAlertEmail(object, (err) => {
//             if (err) {
//                 console.log("restart email alert failed")
//             }
//         })
//     }
// }
// checkServerRestarted()

const checkBothHourlyAlert = (callback) => {
    auto({
        checkLastUploadedFile: (cb) => {
            // return cb()
            if (process.env.NODE_ENV_LABEL && process.env.NODE_ENV_LABEL.toUpperCase() === 'MARK_PROD') {
                checkForLastUploadedFile((err) => {
                    if (err) {
                        console.error("checkForLastUploadedFile err:", err)
                    }
                    cb(err)
                })
            }
        },
        checkDisabledOCR: (cb) => {
            cb()
        }
    }, callback)
}

const checkAlerts = (hours, minutes, seconds) => {
    // console.log("MINUTES, SECONDS", minutes, seconds)
    if (seconds === 0 && minutes % 7 === 0 && ((!lastAlertSend15) || (lastAlertSend15 && getTimeDifferenceInSec(lastAlertSend15, new Date()) >= 900))) {
        console.log("lastAlertSend15 =====>", lastAlertSend15)
        console.log("INSIDE IF FOR ALERT===", minutes, seconds)
        checkIfFileIsInQueue((err) => {
            if (err) {
                console.log("err in checkIfFileIsInQueue", err)
            }
            console.log("checkIfFileIsInQueue COMPLETED===")
        })
    }
    // 30 Mins
    // if (seconds === 0 && thirtyMinutes.includes(minutes))
    if (seconds === 0 && ((!lastAlertSend30) || (lastAlertSend30 && (getTimeDifferenceInSec(lastAlertSend30, new Date())) >= serverThresholdTime))) {
        // console.log("lastAlertSend30===>", lastAlertSend30)
        // console.log("INSIDE IF FOR 30 Minutes ALERT===", minutes, seconds)
        checkForServerBusy((err) => {
            if (err) {
                console.log("err in checkForServerBusy", err)
            }
            console.log("checkForServerBusy COMPLETED===")
        })
    }
    if ((process.env.NODE_ENV_LABEL && process.env.NODE_ENV_LABEL.toUpperCase() === 'MARK_SCALAR') && checkTimeForScalar(startTime, endTime)) {
        if (seconds === 0 && ((!lastAlertSendTwo30) || (lastAlertSendTwo30 && (getTimeDifferenceInSec(lastAlertSendTwo30, new Date())) >= serverThresholdTime))) {
            console.log("lastAlertSendTwo30===>", lastAlertSendTwo30)
            console.log("INSIDE IF FOR 30 New  Minutes ALERT===", minutes, seconds)
            checkServerBusyStatus((err) => {
                if (err) {
                    console.log("err in checkServerBusyStatus", err)
                }
                console.log("checkServerBusyStatus COMPLETED===")
            })
        }
    }
    if (seconds === 0 && ((!lastAlertSendTwo30) || (lastAlertSendTwo30 && (getTimeDifferenceInSec(lastAlertSendTwo30, new Date())) >= serverThresholdTime))) {
        console.log("lastAlertSendTwo30===>", lastAlertSendTwo30)
        console.log("INSIDE IF FOR 30 New  Minutes ALERT===", minutes, seconds)
        checkServerBusyStatus((err) => {
            if (err) {
                console.log("err in checkServerBusyStatus", err)
            }
            console.log("checkServerBusyStatus COMPLETED===")
        })
    }
    if (seconds === 0 && ((!lastAlertSendTwo30) || (lastAlertSendForOCR && (getTimeDifferenceInSec(lastAlertSendForOCR, new Date())) >= serverThresholdTime))) {
        console.log("lastAlertSendForOCR===>", lastAlertSendForOCR)
        console.log("INSIDE IF FOR 30 OCR  Minutes ALERT===", minutes, seconds)
        checkForOcrEnabledTime((err) => {
            if (err) {
                console.log("err in checkForOcrEnabledTime", err)
            }
            console.log("checkForOcrEnabledTime COMPLETED===")
        })
    }

    // if (seconds === 0 && minutes === 0)
    // hourly check\
    if (seconds === 0 && ((!lastAlertSendOneHour) || (lastAlertSendOneHour && getTimeDifferenceInSec(lastAlertSendOneHour, new Date()) >= twoHourThreshold))) {
        console.log("lastAlertSendOneHour==>", lastAlertSendOneHour)
        checkBothHourlyAlert((err) => {
            if (err) {
                console.log("err in checkForServerBusy", err)
            }
            console.log("checkForServerBusy COMPLETED===")
        })
    }
    if (seconds === 0 && ((!lastAlertSendOneHour2) || (lastAlertSendOneHour2 && getTimeDifferenceInSec(lastAlertSendOneHour2, new Date()) >= oneHourThreshold))) {
        // return cb()
        console.log("lastAlertSendOneHour2 =====>", lastAlertSendOneHour2)
        checkIfDisabled((err) => {
            if (err) {
                console.error("checkIfDisabled err:", err)
            }
        })
    }
    // callback()
}
module.exports = {
    checkIfFileIsInQueue,
    checkForServerBusy,
    checkForLastUploadedFile,
    checkIfDisabled,
    checkAlerts,
    checkServerRestarted
};
