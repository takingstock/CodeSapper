const config = require("config")
const { exec } = require("child_process");
const async = require("async");
const { sendEmail: sendNotification } = require('./imc-endpoints.util');
const { executeRemoteSSHQuery, toTimeZone } = require("./universal-functions.util");
// const { getAiServerMappingDetails } = require('./serverMapping')
const { serverStatusAi, serverStatusOCR } = require('./serverMapping')
const { serverStatus } = require("./servers");
const { documentService } = require('../Services');

const OCR = config.get('OCR');
const OCR_APIS = OCR.APIS.DOCUMENT_OCR

let DEFAULT_PORT = process.env.AI_PORT || 7035
// eslint-disable-next-line no-use-before-define
const { ip, port } = getPortAndIp(OCR_APIS)
let ipAddress = [];
let dIpAddress = [ip];
let sIpAddress = [];

let checkAllIPFlag = false;
if (process.env.GB_INFRA || process.env.NODE_ENV === "scalar") {
    dIpAddress = []
    const aiServerStartIpRange = process.env.AI_SERVER || "10.0.120.x"
    for (let i = (+process.env.AI_SERVER_START_RANGE); i < (+process.env.AI_SERVER_END_RANGE); i++) {
        const aiIp = aiServerStartIpRange.replace('x', i)
        dIpAddress.push(aiIp);
    }
} else {
    DEFAULT_PORT = port
    console.log("PORT updated: ", DEFAULT_PORT)
}
if (process.env.GB_INFRA || process.env.NODE_ENV === "scalar") {
    sIpAddress = []
    const sAiServerStartIpRange = process.env.S_AI_SERVER || "10.0.120.x"
    for (let i = (+process.env.S_AI_SERVER_START_RANGE); i < (+process.env.S_AI_SERVER_END_RANGE); i++) {
        const aiIp = sAiServerStartIpRange.replace('x', i)
        sIpAddress.push(aiIp);
    }
} else {
    DEFAULT_PORT = port
    console.log("PORT updated: ", DEFAULT_PORT)
}
dIpAddress.forEach((address) => {
    serverStatus[`ip_${address}`] = {
        lastReservedAt: null,
        lastRequestSentAt: null,
        lastResponseReceivedAt: null,
        lastRequestSentType: null, // FILE_OCR, DOCUMENT_OCR
        lastUnreachable: null,
        lastResurrect: null,
        totalRequestSent: 0,
        totalReboots: 0,
        sshUP: false,
        allocated: true,
        kvpNormal: false,
        ip: address,
        splitFile: false,
        currentStatus: 'INITIALIZE', // FREE // BUSY
        FIELD_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        TABLE_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        AUTO_TABLE_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        SNIPPET: { totalRequestSent: 0, currentStatus: 'FREE' },
        KEY_VALUE: { totalRequestSent: 0, currentStatus: 'FREE', lastRequestSentAt: null, lastReservedAt: null, lastResponseReceivedAt: null },
        PDF_GENERATOR: { totalRequestSent: 0, currentStatus: 'FREE' },
        IMAGE_ROTATOR: { totalRequestSent: 0, currentStatus: 'FREE' }
    }
})

// const serverStatus = {}
function resetIpAddress(address) {
    return {
        lastReservedAt: null,
        lastRequestSentAt: null,
        lastResponseReceivedAt: null,
        lastRequestSentType: null, // FILE_OCR, DOCUMENT_OCR
        lastUnreachable: null,
        lastResurrect: null,
        totalRequestSent: 0,
        totalReboots: 0,
        sshUP: false,
        allocated: true,
        ip: address,
        currentStatus: 'INITIALIZE', // FREE // BUSY
        kvpNormal: false,
        splitFile: serverStatus[`ip_${address}`].splitFile,
        SNIPPET: { totalRequestSent: 0, currentStatus: 'FREE' },
        FIELD_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        TABLE_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        AUTO_TABLE_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        KEY_VALUE: { totalRequestSent: 0, currentStatus: 'FREE', lastRequestSentAt: null, lastReservedAt: null, lastResponseReceivedAt: null },
        PDF_GENERATOR: { totalRequestSent: 0, currentStatus: 'FREE' },
        IMAGE_ROTATOR: { totalRequestSent: 0, currentStatus: 'FREE' }
    }
}

sIpAddress.forEach((address) => {
    serverStatus[`ip_${address}`] = {
        lastReservedAt: null,
        lastRequestSentAt: null,
        lastResponseReceivedAt: null,
        lastRequestSentType: null, // FILE_OCR, DOCUMENT_OCR
        lastUnreachable: null,
        lastResurrect: null,
        totalRequestSent: 0,
        totalReboots: 0,
        sshUP: false,
        allocated: true,
        kvpNormal: false,
        ip: address,
        splitFile: true,
        currentStatus: 'INITIALIZE', // FREE // BUSY
        SNIPPET: { totalRequestSent: 0, currentStatus: 'FREE' },
        FIELD_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        TABLE_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        AUTO_TABLE_COMPLETION: { totalRequestSent: 0, currentStatus: 'FREE' },
        KEY_VALUE: { totalRequestSent: 0, currentStatus: 'FREE', lastRequestSentAt: null, lastReservedAt: null, lastResponseReceivedAt: null },
        PDF_GENERATOR: { totalRequestSent: 0, currentStatus: 'FREE' },
        IMAGE_ROTATOR: { totalRequestSent: 0, currentStatus: 'FREE' }
    }
})
ipAddress = dIpAddress.concat(sIpAddress)
const finalActiveServers = [];
let shortlistActiveRunning = false;
function freeServer(server) {
    server.currentStatus = 'FREE';
    server.IMAGE_ROTATOR.currentStatus = 'FREE';
    server.KEY_VALUE.currentStatus = 'FREE';
    server.PDF_GENERATOR.currentStatus = 'FREE';
    server.SNIPPET.currentStatus = 'FREE';
    server.FIELD_COMPLETION.currentStatus = 'FREE';
    server.TABLE_COMPLETION.currentStatus = 'FREE';
    server.AUTO_TABLE_COMPLETION.currentStatus = 'FREE';
    server.kvpNormal = false

    // reset counts on serverUp
    ipAddress.forEach((address) => {
        if (serverStatus[`ip_${address}`]) {
            serverStatus[`ip_${address}`].SNIPPET.totalRequestSent = 0
            serverStatus[`ip_${address}`].FIELD_COMPLETION.totalRequestSent = 0
            serverStatus[`ip_${address}`].TABLE_COMPLETION.totalRequestSent = 0
            serverStatus[`ip_${address}`].AUTO_TABLE_COMPLETION.totalRequestSent = 0
        }
    })
}
function shortlistActiveServers(firstRun) {
    if (shortlistActiveRunning) {
        console.log('shortlistActiveRunning already')
        return;
    }
    shortlistActiveRunning = true;
    console.log('load balancer triggered shortlistActiveServers');
    const serversResurrected = [];
    async.eachLimit(ipAddress, 15, (singleIP, cb) => {
        // const serverInitialized = false;
        if (firstRun || checkAllIPFlag) {
            // all ok
        } else if (serverStatus[`ip_${singleIP}`] && serverStatus[`ip_${singleIP}`].currentStatus === 'UNREACHABLE') {
            // recheck only unreachable ones
            // console.log('going to recheck ',singleIP)
        } else {
            // console.log('returning shortlistActiveServers as not required ')
            // return cb();
        }

        // new check logics
        if (serverStatus[`ip_${singleIP}`] && ['RESERVE', 'HOLD'].includes(serverStatus[`ip_${singleIP}`].currentStatus)) {
            console.log(' no need to check', singleIP, 'returning from busy reserve ')
            return cb();
        }
        if (checkAllIPFlag) {
            // go ahead
            // console.log('going to check checkAllIPFlag true', singleIP)
        } else if (serverStatus[`ip_${singleIP}`] && ['UNREACHABLE', 'REBOOTING'].includes(serverStatus[`ip_${singleIP}`].currentStatus)) {
            // go ahead
            // console.log('going to check', singleIP)
        } else if (firstRun) {
            // go ahead
        } else if (serverStatus[`ip_${singleIP}`] && (serverStatus[`ip_${singleIP}`].currentStatus === 'FREE' || serverStatus[`ip_${singleIP}`].currentStatus === 'SSH_DOWN')) {
            //proceed further for FREE server or SSH down also
        } else if (serverStatus[`ip_${singleIP}`] && serverStatus[`ip_${singleIP}`].currentStatus === 'MAPPING_DOWN') {
            // console.log('returning shortlistActiveServers as not required ',singleIP)
        } else if (serverStatus[`ip_${singleIP}`] && serverStatus[`ip_${singleIP}`].currentStatus === 'INITIALIZE' && serverStatus[`ip_${singleIP}`].sshUP) {
            // this server was up initially later on ai port went down, check this
        } else if (serverStatus[`ip_${singleIP}`] && serverStatus[`ip_${singleIP}`].currentStatus === 'BUSY') {
            // this server might be dead if auto scaler goes down
        } else {
            console.log('returning shortlistActiveServers as not required ', singleIP)
            return cb();
        }
        // console.log('LB check for ',singleIP,'serverStatus[`ip_${singleIP}`].currentStatus',serverStatus[`ip_${singleIP}`].currentStatus)
        // eslint-disable-next-line no-use-before-define
        checkIfWorkerisActive(singleIP, (err, isActive) => {
            let freeToUnreachable = false;
            let mappingDownToUnreachable = false;
            let busyToUnreachable = false
            if (isActive) {
                console.log('loadbalancer serversResurrected', singleIP, 'isActive', isActive)
                if (!serverStatus.hasOwnProperty(`ip_${singleIP}`)) {
                    // was never on
                    if (!serverStatus[`ip_${singleIP}`]) {
                        serverStatus[`ip_${singleIP}`] = {}
                    }
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    freeServer(serverStatus[`ip_${singleIP}`]);
                    serverStatus[`ip_${singleIP}`].sshUP = true
                    serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString();
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                    // serversResurrected.push('ip_' + singleIP);
                }
                else if (serverStatus[`ip_${singleIP}`].currentStatus === 'INITIALIZE') {
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    freeServer(serverStatus[`ip_${singleIP}`]);
                    serverStatus[`ip_${singleIP}`].sshUP = true
                    if (!serversResurrected.includes(`ip_${singleIP}`)) {
                        serversResurrected.push(`ip_${singleIP}`);
                    }
                    //   console.log('last stats was INITIALIZE', singleIP)
                }
                else if (serverStatus[`ip_${singleIP}`].currentStatus === 'UNREACHABLE') {
                    //   console.log('last stats was UNREACHABLE', singleIP)

                    // this server has resurrected
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    freeServer(serverStatus[`ip_${singleIP}`]);
                    serverStatus[`ip_${singleIP}`].sshUP = true
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                    if (!serversResurrected.includes(`ip_${singleIP}`)) {
                        serversResurrected.push(`ip_${singleIP}`);
                    }
                    // serversResurrected.push(`ip_${singleIP}`);
                }
                else if (serverStatus[`ip_${singleIP}`].currentStatus === 'REBOOTING') {
                    //   console.log('last stats was REBOOTING', singleIP)

                    // this server has resurrected
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    freeServer(serverStatus[`ip_${singleIP}`]);
                    // serverStatus['ip_' + singleIP].sshUP = true
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                    serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString()
                    // serversResurrected.push(`ip_${singleIP}`);
                    if (!serversResurrected.includes(`ip_${singleIP}`)) {
                        serversResurrected.push(`ip_${singleIP}`);
                    }
                }
                else if (serverStatus[`ip_${singleIP}`].currentStatus === 'NO_MAPPING') {
                    console.log('no mapping yet for server', serverStatus[`ip_${singleIP}`])
                    if (serverStatusAi[`ip_${singleIP}`].allocated) {
                        // now its allocated
                        console.log('now its allocated for', singleIP)
                        serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                        freeServer(serverStatus[`ip_${singleIP}`]);
                    }
                }
                else if (serverStatus[`ip_${singleIP}`].currentStatus === 'MAPPING_DOWN') {
                    let mappingDownAt = serverStatus[`ip_${singleIP}`].mappingDownAt;
                    console.log('mapping down for this server since', serverStatus[`ip_${singleIP}`].mappingDownAt);
                    process.emit('checkOCRMappingUpAndUpdate', singleIP)
                    let timeDiff = new Date().getTime() - new Date(mappingDownAt).getTime()
                    if (timeDiff && timeDiff > (15 * 60 * 1000)) {
                        // restart this server
                        let avoidReboot = false;
                        if (serverStatus[`ip_${singleIP}`].lastReboot && new Date(serverStatus[`ip_${singleIP}`].lastReboot).getTime() - new Date().getTime() <= (20 * 60 * 1000)) {
                            avoidReboot = true;
                        }
                        console.log('avoidReboot', avoidReboot)
                        if (!avoidReboot) {
                            console.log('executingRebootforMappingDown>>>', singleIP)
                            serverStatus[`ip_${singleIP}`].currentStatus = 'REBOOTING';
                            serverStatus[`ip_${singleIP}`].lastReboot = new Date().toISOString()
                            serverStatus[`ip_${singleIP}`].totalReboots++
                            const payload = {
                                serversArray: [singleIP],
                                serverFlag: 'REBOOTING',
                                serverType: 'AI_SERVER'
                            }
                            sendLBNotification(payload)
                            executeRemoteSSHQuery('sudo reboot', singleIP)
                        }

                    } else {
                        console.log('timeDiff', timeDiff)
                    }
                }
                else if (serverStatus[`ip_${singleIP}`].currentStatus === 'SSH_DOWN') {
                    //   console.log('last stats was REBOOTING', singleIP)
                    // this server has resurrected
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    freeServer(serverStatus[`ip_${singleIP}`]);
                    serverStatus[`ip_${singleIP}`].sshUP = true;
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                    serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString()
                    if (!serversResurrected.includes(`ip_${singleIP}`)) {
                        serversResurrected.push(`ip_${singleIP}`);
                    }
                    // serversResurrected.push('ip_' + singleIP);
                }
                else {
                    console.log('no action for', singleIP, serverStatus[`ip_${singleIP}`].currentStatus)
                }
            } else {
                // console.log('loadbalancer serversResurrected', singleIP, 'isActive', isActive,'currentstats',serverStatus[`ip_${singleIP}`].currentStatus)
                if (serverStatus[`ip_${singleIP}`].totalRequestSent) {
                    if (serverStatus[`ip_${singleIP}`].currentStatus === 'FREE') {
                        freeToUnreachable = true
                    }
                    if (serverStatus[`ip_${singleIP}`].currentStatus === 'BUSY') {
                        busyToUnreachable = true
                    }
                    if (serverStatus[`ip_${singleIP}`].currentStatus === 'MAPPING_DOWN') {
                        mappingDownToUnreachable = true
                    }
                    serverStatus[`ip_${singleIP}`].currentStatus = 'UNREACHABLE';
                    if (!serverStatus[`ip_${singleIP}`].lastUnreachable) {
                        serverStatus[`ip_${singleIP}`].lastUnreachable = new Date().toISOString()
                    }
                }

                // check if port 22 is open
                if (serverStatus[`ip_${singleIP}`].currentStatus === 'REBOOTING') {
                    // skip
                    //   console.log('Rebooting in process>>', singleIP)
                } else {
                    // eslint-disable-next-line no-use-before-define
                    // if lastSSHUP is more than 2 mins and app still not up, restart it
                    checkIfSSHIsUp(singleIP, (err, isActive) => {
                        if (isActive) {
                            const timeDiff = new Date().getTime() - new Date(serverStatus[`ip_${singleIP}`].lastUnreachable).getTime()
                            console.log('sshIsUpButAppIsDownForAI', singleIP, firstRun, timeDiff)
                            let timeDiffForSSHUp = 0;
                            if (serverStatus[`ip_${singleIP}`].lastSSHUP) {
                                timeDiffForSSHUp = new Date().getTime() - new Date(serverStatus[`ip_${singleIP}`].lastSSHUP).getTime()
                            }
                            console.log('timeDiffForSSHUpforAI', timeDiffForSSHUp)
                            if ((!firstRun && timeDiffForSSHUp && timeDiffForSSHUp > (1000 * 60 * 10)) || (!firstRun && serverStatus[`ip_${singleIP}`].totalRequestSent && timeDiff >= (1000 * 60 * 10))) {
                                let avoidReboot = false;
                                if (serverStatus[`ip_${singleIP}`].lastReboot && new Date(serverStatus[`ip_${singleIP}`].lastReboot).getTime() - new Date().getTime() <= (20 * 60 * 1000)) {
                                    avoidReboot = true;
                                }
                                console.log('avoidReboot', avoidReboot)
                                if (!avoidReboot) {
                                    console.log('executingRebootforInitialize>>>', singleIP)
                                    serverStatus[`ip_${singleIP}`].currentStatus = 'REBOOTING';
                                    serverStatus[`ip_${singleIP}`].lastReboot = new Date().toISOString()
                                    serverStatus[`ip_${singleIP}`].totalReboots++
                                    const payload = {
                                        serversArray: [singleIP],
                                        serverFlag: 'REBOOTING',
                                        serverType: 'AI_SERVER'
                                    }
                                    sendLBNotification(payload)
                                    executeRemoteSSHQuery('sudo reboot', singleIP)
                                }

                            }
                        }
                        else {
                            if (busyToUnreachable) {
                                process.emit("FORCE_FAILURE_FILE_ON_BUSY_TO_UNREACHABLE", { data: serverStatus[`ip_${singleIP}`], from: "LOAD_BALANCER" })
                            }
                            if (freeToUnreachable || mappingDownToUnreachable || busyToUnreachable) {
                                // free to ssh down or mappingDownToUnreachable
                                serverStatus[`ip_${singleIP}`] = resetIpAddress(singleIP)
                                console.log('resetting it to default now', singleIP)
                                console.log('free to ssh down')
                                const payload = {
                                    serversArray: [singleIP],
                                    serverFlag: 'SSH_DOWN',
                                    serverType: 'AI_SERVER'
                                }
                                sendLBNotification(payload)
                            }
                            // ssh is also down, remove from list
                            serverStatus['ip_' + singleIP].currentStatus = 'SSH_DOWN';
                        }
                        serverStatus[`ip_${singleIP}`].sshUP = !!isActive;
                        if (serverStatus[`ip_${singleIP}`].sshUP) {
                            if (serverStatus[`ip_${singleIP}`].lastSSHUP) {
                                //   console.log('lastsshup already set')
                            } else {
                                serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString()
                            }
                        }
                    })
                }
            }
            cb();
        })
    }, () => {
        for (const key in serverStatus) {
            if (serverStatus[key].currentStatus === 'FREE' && firstRun && !finalActiveServers.includes(key)) {
                finalActiveServers.push(key)
            }
        }
        if (checkAllIPFlag) {
            checkAllIPFlag = false;
        }

        if (firstRun) {
            //   console.log('firstRun', !!firstRun)
        }
        //   console.log('serversResurrected.length', serversResurrected.length)
        if (serversResurrected.length) {
            //   console.log('serversResurrected>>', serversResurrected);
            const payload = {
                serversArray: serversResurrected,
                serverFlag: 'RESURRECT'
            }
            if (firstRun) {
                // skip sending email
            } else {
                // eslint-disable-next-line no-use-before-define
                sendLBNotification(payload)
            }
        }
        if (firstRun) {
            //   console.log('Final Initialized Servers', finalActiveServers)
            process.emit('updateFinalActiveServers', finalActiveServers.length)
        } else if (serversResurrected.length) {
            process.emit('addResurrectedServers', { serversResurrected: serversResurrected.length, firstRun })
        }
        shortlistActiveRunning = false;
    })
}
process.on('startShortlistActiveRunning', () => {
    shortlistActiveServers(false)
})

// console.log('ILB Initialized...', ipAddress, 'port 7021')
shortlistActiveServers(true)

function sendLBNotification(payload) {
    // console.log("NOTIFICATION SENT>>>>>>>>>>>>>>>>>>>>>>", payload)
    const NODE_ENV = process.env.NODE_ENV_LABEL || process.env.NODE_ENV
    if (payload.serversArray && payload.serversArray.length) {
        const dataToSend = {
            // emailArray: ['shahab@amygb.ai'], // stop
            subject: `IDP OCR Server Update | UNREACHABLE | ${NODE_ENV}`,
            body: `Server Not Reachable :<br>${JSON.stringify(payload.serversArray)}<br>`,
            attachmentNames: [],
            triggerNow: true,
            apiTarget: 'OCR'
            // attachmentPath: filePath
        };
        if (payload.serverFlag === 'RESURRECT') {
            dataToSend.subject = `IDP Server Update | RESURRECT | ${NODE_ENV}`;
            dataToSend.apiTarget = 'OCR'
            dataToSend.body = `Server Resurrected : <br> Type : AI_SERVER <br>${JSON.stringify(payload.serversArray)}`;
        }
        if (payload.serverFlag === 'SSH_DOWN') {
            dataToSend.subject = `IDP Server Update | SHUTDOWN | ${NODE_ENV}`;
            dataToSend.apiTarget = 'OCR'
            dataToSend.body = `Server has been shutdown/restarted : <br> Type : AI_SERVER <br>${JSON.stringify(payload.serversArray)}`;
        }
        if (payload.serverFlag === 'SNIPPET_DOWN') {
            dataToSend.subject = `IDP Server Update | SNIPPET_DOWN | ${NODE_ENV}`;
            dataToSend.apiTarget = 'OCR'
            dataToSend.body = `Snippet is down : <br> Type : SNIPPET_DOWN <br>${JSON.stringify(payload.serversArray)}`;
        }
        if (payload.serverFlag === 'SNIPPET_RESSURECT') {
            dataToSend.subject = `IDP Server Update | SNIPPET_RESSURECT | ${NODE_ENV}`;
            dataToSend.apiTarget = 'OCR'
            dataToSend.body = `Snippet is up : <br> Type : SNIPPET_RESSURECT <br>${JSON.stringify(payload.serversArray)}`;
        }
        if (payload.serverFlag === 'SNIPPET_RESSURECT_FAILURE') {
            dataToSend.subject = `IDP Server Update | CRITICAL | SNIPPET_RESSURECT_FAILURE | ${NODE_ENV}`;
            dataToSend.apiTarget = 'OCR'
            dataToSend.body = `Snippet is down Critical : <br> Type : SNIPPET_RESSURECT_FAILURE <br>${JSON.stringify(payload.serversArray)}`;
        }
        if (payload.serverFlag === 'REBOOTING') {
            dataToSend.subject = `IDP Server Update | REBOOTING | ${NODE_ENV}`;
            dataToSend.apiTarget = 'OCR'
            dataToSend.body = `Server Rebooting: <br> Type : ${payload.serverType || "AI_SERVER"} <br> ${JSON.stringify(payload.serversArray)}`;
        } else {
            // payload.serversArray.forEach(function (remote_ip) {
            //     executeRemoteSSHQuery('sudo reboot',remote_ip)
            // })
        }
        console.log('sending email from loadbalancer for ', payload.serverFlag, payload.serversArray)
        sendNotification(dataToSend, () => { console.log('Notification Sent') });
    } else {
        //   console.log('IMP_ERROR_sendLBNotification')
    }
}

function occupyServer(keyName, reserveFlag, type = "FILE_OCR") {
    //   console.log('occupyServer', keyName)
    if (!keyName) {
        return
    }
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (reserveFlag) {
        serverStatus[keyName].currentStatus = 'RESERVE';
        serverStatus[keyName].lastReservedAt = new Date().toISOString();
        // not anything else
    } else {
        serverStatus[keyName].currentStatus = 'BUSY';
        serverStatus[keyName].totalRequestSent++;
        serverStatus[keyName].lastRequestSentType = type
        serverStatus[keyName].lastRequestSentAt = new Date().toISOString();
    }
}

function occupyKvpNormalServer(keyName, reserveFlag) {
    //   console.log('occupyServer', keyName)
    if (!keyName) {
        return
    }
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (reserveFlag) {
        serverStatus[keyName].kvpNormal = true
        serverStatus[keyName]["KEY_VALUE"].currentStatus = "RESERVE"
        serverStatus[keyName]["KEY_VALUE"].lastReservedAt = new Date().toISOString();
        // not anything else
    } else {
        serverStatus[keyName].kvpNormal = true
        serverStatus[keyName]["KEY_VALUE"].currentStatus = "BUSY"
        serverStatus[keyName]["KEY_VALUE"].totalRequestSent++;
        serverStatus[keyName]["KEY_VALUE"].lastRequestSentAt = new Date().toISOString();
    }
}

function sendUnreachableServerEmailNotification() {
    const unreachableServerList = [];
    const rebootServers = [];
    const currentTime = new Date().getTime()
    for (const key in serverStatus) {
        if (serverStatus[key].sshUP && ((serverStatus[key].lastUnreachable && serverStatus[key].currentStatus === 'UNREACHABLE') || (serverStatus[key].currentStatus === 'INITIALIZE'))) {
            const lastUnreachableTime = (serverStatus[key].lastUnreachable && new Date(serverStatus[key].lastUnreachable).getTime()) || 0;
            let lastResurrectTime = 0;
            if (serverStatus[key].lastResurrect) {
                lastResurrectTime = new Date(serverStatus[key].lastResurrect).getTime()
            }
            // if server has been up for more than an hour and still 7021 is not responding then reboot
            let lastSSHUpTiming = 0;
            if (serverStatus[key].lastSSHUP) {
                lastSSHUpTiming = new Date(serverStatus[key].lastSSHUP).getTime()
            }
            //   console.log('lastSSHUpTiming', lastSSHUpTiming)
            //   console.log('currentTime', currentTime)
            //   console.log('currentTime', currentTime)
            const timeDiff = currentTime - lastSSHUpTiming
            //   console.log('diff', timeDiff)
            //   console.log('diff check timeDiff  >  ( 9 * 60 * 1000)', timeDiff > (9 * 60 * 1000))
            if (lastSSHUpTiming && timeDiff > (9 * 60 * 1000)) {
                // try to restart
                //   console.log('server down for 15 mins, trying restart')
                if (!rebootServers.includes(key)) {
                    rebootServers.push(key)
                }
                serverStatus[key].currentStatus = 'REBOOTING';
                // executeRemoteSSHQuery('sudo reboot', key.substr(3))
            }

            if (lastUnreachableTime && currentTime - lastUnreachableTime >= (5 * 60 * 1000)) {
                // this has been down since 10 mins
                // check for resurrect
                if (lastResurrectTime && lastResurrectTime >= lastUnreachableTime) {
                    // avoid this as it has resurrected
                } else if (!unreachableServerList.includes(unreachableServerList)) {
                    unreachableServerList.push(key)
                }
            }
        }
    }
    if (unreachableServerList.length) {
        const payload = {
            serversArray: unreachableServerList,
            serverFlag: 'UNREACHABLE'
        }
        // eslint-disable-next-line no-use-before-define
        sendLBNotification(payload)
    }
    if (rebootServers.length) {
        const payload = {
            serversArray: rebootServers,
            serverFlag: 'REBOOTING'
        }
        sendLBNotification(payload)
    }
}
function mappingDown(keyName) {
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    serverStatus[keyName].currentStatus = 'MAPPING_DOWN';
    serverStatus[keyName].mappingDownAt = new Date().toISOString();
}
setInterval(() => {
    checkAllIPFlag = true;
    sendUnreachableServerEmailNotification()
}, 5 * 60 * 1000) // every 5 min

function discardServer(keyName) {
    // console.log('discardServer', keyName)
    // console.log('occupyServer', keyName)
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (!serverStatus[keyName]) {
        return
    }
    serverStatus[keyName].currentStatus = 'UNREACHABLE';
    serverStatus[keyName].lastUnreachable = new Date().toISOString();

    const payload = {
        serversArray: [keyName],
        serverFlag: 'UNREACHABLE'
    }
    sendLBNotification(payload)
}

function resurrectServer(keyName) {
    // console.log('resurrectServer', keyName)
    // console.log('occupyServer', keyName)
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    serverStatus[keyName].currentStatus = 'FREE';
    serverStatus[keyName].kvpNormal = false
    serverStatus[keyName]["KEY_VALUE"].currentStatus = "FREE"
    serverStatus[keyName].lastResurrect = new Date().toISOString();
}

function releaseServer(keyName, reserveFlag) {
    // console.log('releaseServer', keyName)
    // console.log('occupyServer', keyName)
    if (!keyName) {
        return
    }
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (serverStatus[keyName]) {
        serverStatus[keyName].currentStatus = 'FREE';
        if (reserveFlag) {
            // releasing from reserve, no action
        } else {
            serverStatus[keyName].lastResponseReceivedAt = new Date().toISOString();
        }
    }
}
function releaseKvpNormalServer(keyName, reserveFlag) {
    // console.log('releaseServer', keyName)
    // console.log('occupyServer', keyName)
    if (!keyName) {
        return
    }
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (serverStatus[keyName]) {
        serverStatus[keyName]["KEY_VALUE"].currentStatus = "FREE"
        serverStatus[keyName].kvpNormal = false
        if (reserveFlag) {
            // releasing from reserve, no action
        } else {
            serverStatus[keyName]["KEY_VALUE"].lastResponseReceivedAt = new Date().toISOString();
        }
    }
}
let sortOrder = 'DESC';
function getFreeServer(dontOccupy, excludeIp = null, staticIp = false) {
    // console.log('getFreeServer',dontOccupy,'excludeIp',excludeIp)
    let freeServerIp = null;
    let originalAddress = null;
    if (sortOrder === 'ASC') {
        ipAddress = ipAddress.sort();
        sortOrder = 'DESC'
    } else {
        ipAddress = ipAddress.sort().reverse();
        sortOrder = 'ASC'
    }
    for (let i = 0; i < ipAddress.length; i++) {
        const address = ipAddress[i];
        // console.log("excludeIp    :  ", excludeIp)
        if (!excludeIp || !(excludeIp && excludeIp.includes(address))) {
            // console.log('inside excludeip if block')
            if (serverStatus[`ip_${address}`].splitFile === staticIp && serverStatus[`ip_${address}`].currentStatus === 'FREE') {
                freeServerIp = `ip_${address}`;
                originalAddress = address;
                break;
            }
        }
    }

    if (freeServerIp) {
        console.log('final originalAddress', originalAddress)
        // const correctMapping = getAiServerMappingDetails(originalAddress);
        // console.log('correctMapping', correctMapping, 'for', originalAddress, 'current status', serverStatus[`ip_${originalAddress}`].currentStatus)
        // if ((process.env.GB_INFRA || process.env.NODE_ENV === "scalar") && !correctMapping) {
        //     if (serverStatus[`ip_${originalAddress}`].currentStatus === 'FREE') {
        //         //these servers are free but their mapping is incorrect..
        //         serverStatus[`ip_${originalAddress}`].currentStatus = "NO_MAPPING";
        //     }
        //
        //     freeServerIp = null
        //     originalAddress = null
        // } else
        if (dontOccupy) {
            // nothing to do
        } else {
            // console.log('call from getfreeserver>>', freeServerIp)
            occupyServer(freeServerIp, true)
        }
    }
    return originalAddress;
}

function getFreeServerKvp(dontOccupy, excludeIp = null, kvpOcr = false, staticIp = false) {
    let freeServerIp = null;
    let originalAddress = null;
    if (sortOrder === 'ASC') {
        ipAddress = ipAddress.sort();
        sortOrder = 'DESC'
    } else {
        ipAddress = ipAddress.sort().reverse();
        sortOrder = 'ASC'
    }
    const freeServerArray = []
    const busyServerArray = []

    for (let i = 0; i < ipAddress.length; i++) {
        const address = ipAddress[i];
        if ((!excludeIp || !(excludeIp && excludeIp.includes(address))) && serverStatus[`ip_${address}`].splitFile === staticIp) {
            if (!serverStatus[`ip_${address}`].kvpNormal) {
                if (kvpOcr) {
                    if (serverStatus[`ip_${address}`].currentStatus === 'FREE') {
                        freeServerIp = `ip_${address}`;
                        originalAddress = address;
                        break;
                    }
                } else if (serverStatus[`ip_${address}`].currentStatus === 'FREE') {
                    // freeServerIp = `ip_${address}`;
                    // originalAddress = address;
                    freeServerArray.push(serverStatus[`ip_${address}`])
                    // break;
                } else if (['BUSY', 'RESERVE'].includes(serverStatus[`ip_${address}`].currentStatus)
                    && serverStatus[`ip_${address}`].lastRequestSentType === "FILE_OCR") {
                    // freeServerIp = `ip_${address}`;
                    // originalAddress = address;
                    busyServerArray.push(serverStatus[`ip_${address}`])
                    // break;
                }
            }
        }
    }
    if (!kvpOcr && freeServerArray.length) {
        const freeServers = freeServerArray.sort((a, b) => a.KEY_VALUE.totalRequestSent - b.KEY_VALUE.totalRequestSent)
        originalAddress = `${freeServers[0].ip}`
        freeServerIp = `ip_${originalAddress}`;
    } else if (!kvpOcr && busyServerArray.length) {
        const busyServers = busyServerArray.sort((a, b) => a.KEY_VALUE.totalRequestSent - b.KEY_VALUE.totalRequestSent)
        originalAddress = `${busyServers[0].ip}`
        freeServerIp = `ip_${originalAddress}`;
    }
    if (freeServerIp) {
        console.log('final originalAddress', originalAddress)
        // const correctMapping = getAiServerMappingDetails(originalAddress);
        // console.log('correctMapping', correctMapping, 'for', originalAddress, 'current status', serverStatus[`ip_${originalAddress}`].currentStatus)
        // if ((process.env.GB_INFRA || process.env.NODE_ENV === "scalar") && !correctMapping) {
        //     if (serverStatus[`ip_${originalAddress}`].currentStatus === 'FREE') {
        //         // these servers are free but their mapping is incorrect..
        //         serverStatus[`ip_${originalAddress}`].currentStatus = "NO_MAPPING";
        //     }
        //     freeServerIp = null
        //     originalAddress = null
        // } else
        if (dontOccupy) {
            // nothing to do
        } else if (!dontOccupy) {
            // console.log('call from getfreeserver>>', freeServerIp)
            if (kvpOcr) {
                occupyServer(freeServerIp, true)
            } else {
                occupyKvpNormalServer(freeServerIp, true)
            }
        }
    }
    return originalAddress;
}

/**
 * fetches the availabe server for kvpNormal || kvpOcr
 * @param {*} kvpNormalOcr
 * @returns
 */
function getAllFreeServerKvpCount(staticIp = false) {
    // console.log('getAllFreeServerKvpNormalCount kvpNormalOcr', kvpNormalOcr)
    let freeServerCountKvpNormal = 0
    let freeServerCountKvpOcr = 0

    // if (process.env.KEY_VALUE_EXTRACT_OCR === 'ENABLED' && !kvpNormalOcr) {
    //     return freeServerCount // as no server availabe for kvpNormal
    // }
    for (let i = 0; i < ipAddress.length; i++) {
        const address = ipAddress[i];
        if (serverStatus[`ip_${address}`].splitFile === staticIp && !serverStatus[`ip_${address}`].kvpNormal) {
            if (serverStatus[`ip_${address}`].currentStatus === 'FREE') {
                freeServerCountKvpOcr++;
                freeServerCountKvpNormal++;
            } else if (['BUSY', 'RESERVE'].includes(serverStatus[`ip_${address}`].currentStatus) && serverStatus[`ip_${address}`].lastRequestSentType === "FILE_OCR") {
                freeServerCountKvpNormal++
            }
        }
    }
    return { freeServerCountKvpNormal, freeServerCountKvpOcr };
}

function getDiscardedServers() {
    const discardedList = [];
    for (let i = 0; i < ipAddress.length; i++) {
        const address = ipAddress[i];
        if (serverStatus[`ip_${address}`].currentStatus === 'UNREACHABLE') {
            discardedList.push(`ip_${address}`);
        }
    }
    return discardedList;
}

function getLBUrlForInternalIP(ipAdd) {
    return `http://${ipAdd}:7021/extract_batch`
}

function getWorkerIpAndPort(ipAdd) {
    return {
        workerIp: ipAdd.includes('_') ? ipAdd.split('_')[1] : ipAdd,
        workerPort: 7021,
    }
}

setInterval(() => {
    shortlistActiveServers(false)
}, 60 * 1000) // every 1 min

function getServerStatus(staticIp = false) {
    const finalStats = {};
    const serverSummary = {};
    for (const key in serverStatus) {
        if (serverStatus[key].splitFile === staticIp && serverStatus[key].sshUP) {
            finalStats[key] = { ...serverStatus[key] }
            if (finalStats[key].lastReservedAt) {
                finalStats[key].lastReservedAt = toTimeZone(finalStats[key].lastReservedAt)
            }
            if (finalStats[key].lastRequestSentAt) {
                finalStats[key].lastRequestSentAt = toTimeZone(finalStats[key].lastRequestSentAt)
            }
            if (finalStats[key].lastResponseReceivedAt) {
                finalStats[key].lastResponseReceivedAt = toTimeZone(finalStats[key].lastResponseReceivedAt)
            }
            if (finalStats[key].lastUnreachable) {
                finalStats[key].lastUnreachable = toTimeZone(finalStats[key].lastUnreachable)
            }
            if (finalStats[key].lastResurrect) {
                finalStats[key].lastResurrect = toTimeZone(finalStats[key].lastResurrect)
            }
            if (serverSummary.hasOwnProperty(serverStatus[key].currentStatus)) {
                serverSummary[serverStatus[key].currentStatus]++
            } else {
                serverSummary[serverStatus[key].currentStatus] = 1
            }
        }
    }
    return { finalStats, serverSummary }
}

function getPortAndIp(url) {
    let ip = null;
    let port = null
    if (url && url.split('/')[0] && url.split('/')[2]) {
        ip = url.split('/')[2].split(':')[0];
        port = url.split('/')[2].split(':')[1];
    }
    return { ip: ip || url, port: port || DEFAULT_PORT }
}

function checkIfWorkerisActive(freeServerIp, callback) {
    const { port, ip } = getPortAndIp(freeServerIp)
    const command = `nc -zv ${ip} ${port}`;
    if (process.env.NODE_ENV === "test") {
        return callback(null, true)
    }
    exec(command, { timeout: 2000 }, (err, stdout, stderr) => {
        if (stderr.includes('succeeded') && err === null) {
            //   console.log('ilb response from exec', err, 'stdout', stdout, 'stderr', stderr)
            callback(null, true)
        } else if (stderr.includes("failed") && err) {
            // console.log('worked failed', command)
            callback(null, false)
        } else {
            // console.log('worked failed', command)
            callback(null, false)
        }
    })
}

function checkIfSSHIsUp(freeServerIp, callback) {
    const { ip } = getPortAndIp(freeServerIp)
    const command = `nc -zv ${ip} 22`;
    // console.log('checkIfWorkerisActive called', command)
    if (process.env.NODE_ENV === "test") {
        return callback(null, true)
    }
    exec(command, { timeout: 2000 }, (err, stdout, stderr) => {
        if (stderr.includes('succeeded') && err === null) {
            //   console.log('ilb response from exec', err, 'stdout', stdout, 'stderr', stderr)
            callback(null, true)
        } else if (stderr.includes("failed") && err) {
            // console.log('worked failed', command)
            callback(null, false)
        } else {
            // console.log('worked failed', command)
            callback(null, false)
        }
    })
}

process.on("lockIp", (data) => {
    console.log("lockIp EVENT listened in LB", data)

    if (data.ocrUrl) {
        const { ip } = getPortAndIp(data.ocrUrl)
        const server = serverStatus[`ip_${ip}`] || serverStatus[`${ip}`]
        if (!server || server.currentStatus === "HOLD") {
            return
        }
        if (!data.ipOcrLock) {
            if (data.kvpNormal) {
                releaseKvpNormalServer(ip)
            } else {
                releaseServer(ip)
            }
        }
        if (data.ipOcrLock && server.currentStatus !== "BUSY") {
            occupyServer(ip)
        }
    }
})

function serverActiveCheck(server) {
    // check for server free and ocr server allocated
    let flag = false
    // console.log(">>>>>>>>>>>>>>>>>>>>>>>.server", server)
    if (server) {
        // console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<", serverStatusAi)
        // console.log("server<<<<<<<<<<<<<<<<<<<<<<<<<<<", serverStatusAi[`ip_${server.ip}`])
        if (process.env.SERVER_MAPPING !== "DISABLED") {
            if (server.sshUP && ['FREE', 'BUSY', 'RESERVE'].includes(server.currentStatus)
                // && serverStatusAi[`ip_${server.ip}`].currentStatus === 'FREE'
                // && serverStatusAi[`ip_${server.ip}`].allocated
            ) {
                flag = true
            }
        } else if (server.sshUP && ['FREE', 'BUSY', 'RESERVE'].includes(server.currentStatus)) {
            flag = true
        }
    }
    return flag
}

function getFreeSnippetServers() {
    let freeServers = Object.values(serverStatus).filter(s => (!s.splitFile) && serverActiveCheck(s) && s.SNIPPET.currentStatus !== "UNREACHABLE")
    console.log('filtered freeServers before sorting', freeServers);
    freeServers = freeServers.sort((a, b) => a.SNIPPET.totalRequestSent - b.SNIPPET.totalRequestSent)
    console.log('after sorting>>>>>>>>', freeServers)
    // .filter(s => s.SNIPPET.currentStatus === "FREE")
    // .sort((a) => {
    //     if (a.currentStatus === "FREE" && a.KEY_VALUE.currentStatus === "FREE") {
    //         return -1
    //     }
    //     return 0
    // })
    return freeServers
}

function getFreeTableCompletionServers() {
    const freeServers = Object.values(serverStatus).filter(s => (!s.splitFile) && serverActiveCheck(s) && s.TABLE_COMPLETION.currentStatus === "FREE").sort((a, b) => a.TABLE_COMPLETION.totalRequestSent - b.TABLE_COMPLETION.totalRequestSent)
    return freeServers
}

function getFreeAutoTableCompletionServers() {
    const freeServers = Object.values(serverStatus).filter(s => (!s.splitFile) && serverActiveCheck(s) && s.AUTO_TABLE_COMPLETION.currentStatus === "FREE").sort((a, b) => a.AUTO_TABLE_COMPLETION.totalRequestSent - b.AUTO_TABLE_COMPLETION.totalRequestSent)
    return freeServers
}

function getFieldCompletionServers() {
    const freeServers = Object.values(serverStatus).filter(s => (!s.splitFile) && serverActiveCheck(s) && s.FIELD_COMPLETION.currentStatus === "FREE").sort((a, b) => a.FIELD_COMPLETION.totalRequestSent - b.FIELD_COMPLETION.totalRequestSent)
    return freeServers
}

function getFreeKeyValueExtractionServers() {
    const freeServers = Object.values(serverStatus).filter(s => (!s.splitFile) && serverActiveCheck(s)).sort((a, b) => a.KEY_VALUE.totalRequestSent - b.KEY_VALUE.totalRequestSent)
    return freeServers
}

function getFreePdfGeneratorServers() {
    const freeServers = Object.values(serverStatus).filter(s => (!s.splitFile) && serverActiveCheck(s))// .sort((a, b) => a.PDF_GENERATOR.totalRequestSent - b.PDF_GENERATOR.totalRequestSent)
        .sort((a, b) => a.PDF_GENERATOR.totalRequestSent - b.PDF_GENERATOR.totalRequestSent)
        .sort((a) => {
            if (a.currentStatus === "FREE" && a.KEY_VALUE.currentStatus === "FREE") {
                return -1
            }
            return 0
        })
    return freeServers
}
function getFreeImageRotatorServers() {
    const freeServers = Object.values(serverStatus).filter(s => (!s.splitFile) && serverActiveCheck(s))// .sort((a, b) => a.IMAGE_ROTATOR.totalRequestSent - b.IMAGE_ROTATOR.totalRequestSent)
        .sort((a, b) => a.IMAGE_ROTATOR.totalRequestSent - b.IMAGE_ROTATOR.totalRequestSent)
        .sort((a) => {
            if (a.currentStatus === "FREE" && a.KEY_VALUE.currentStatus === "FREE") {
                return -1
            }
            return 0
        })
    return freeServers
}
function totalActiveServers() {
    let activeServers = 0
    Object.values(serverStatus).forEach(server => {
        if (server && serverActiveCheck(server)) {
            activeServers++
        }
    })
    return activeServers
}

function executeBashScript(server, serverType) {
    const query = `sudo reboot`
    console.log('executeBashScriptexecuteBashScript ipAi>>>', serverType, server.ip)
    let bashScriptRun = false
    // reboot ai server
    if (server.rebootBash) {
        server.currentStatus = 'REBOOTING';
        server.lastReboot = new Date().toISOString()
        server.lastUnreachable = new Date().toISOString()
        server.totalReboots = server.totalReboots ? server.totalReboots + 1 : 1;
        const payload = {
            serversArray: [server.ip],
            serverFlag: 'REBOOTING',
            serverType
        }
        bashScriptRun = true
        server.rebootBash = null
        executeRemoteSSHQuery(query, server.ip)
        sendLBNotification(payload)
    }
    return bashScriptRun
}
function checkDocInProgressByAiServer(aiServer, callback) {
    let flagServerInUse = false;
    async.auto({
        documents: (cb) => {
            documentService.findAll({ aiStatus: "OCR_INPROGRESS" }, { ocrUrl: 1 }, null, cb);
        },
        checkOcrServerInUse: ['documents', ({ documents = [] }, cb) => {
            documents.forEach((d) => {
                if (d.ocrUrl.includes(aiServer)) {
                    flagServerInUse = true
                }
            })
            cb()
        }]
    }, (e) => {
        console.log("checkDocInProgressByAiServer e", e);
        return callback(null, flagServerInUse)
    })
}
function checkRebootDone(callback) {
    console.log("checkRebootDone")
    let rebootedAllServers = true
    async.auto({
        mappedServer: (cb) => {
            async.eachLimit(Object.keys(serverStatus), 1, (key, ecb) => {
                const ocrIp = serverStatusAi[key] && serverStatusAi[key].ocrServer
                const ocrServer = serverStatusOCR[`ip_${ocrIp}`]
                const aiServer = serverStatus[key]
                let rebootOcr = false
                let rebootAi = false
                if (ocrServer && ocrServer.rebootBash) {
                    rebootedAllServers = false
                    console.log("server to reboot ocr", ocrServer)
                    if (aiServer.currentStatus !== "BUSY" && aiServer.KEY_VALUE.currentStatus !== "BUSY") {
                        rebootOcr = true
                        // executeBashScript(ocrServer, "OCR_SERVER")
                    }
                }
                if (aiServer && aiServer.rebootBash) {
                    rebootedAllServers = false
                    console.log("server to reboot ai", aiServer)
                    if (aiServer.currentStatus !== "BUSY") {
                        rebootAi = true
                        // executeBashScript(aiServer, "AI_SERVER")
                    }
                }
                if (aiServer && aiServer.currentStatus === "HOLD") {
                    rebootAi = false
                    rebootOcr = false
                    // skip reboot
                }
                if (rebootOcr || rebootAi) {
                    console.log("checkDocInProgressByAiServer BEFORE")
                    checkDocInProgressByAiServer(aiServer.ip, (e, serverInUseflag) => {
                        console.log("checkDocInProgressByAiServer AFTER serverInUseflag", serverInUseflag)
                        if (!serverInUseflag) {
                            if (rebootAi) {
                                executeBashScript(aiServer, "AI_SERVER")
                            }
                            if (rebootOcr) {
                                // executeBashScript(ocrServer, "OCR_SERVER")
                            }
                        }
                        ecb() // todo
                    })
                } else {
                    console.log("nothing to rebbot")
                    ecb()
                }
            }, cb)
        },
        serverNotmapped: (cb) => {
            return cb()
            // async.eachLimit(Object.keys(serverStatusOCR), 1, (key, ecb) => {
            //     const ocrServer = serverStatusOCR[key]
            //     if (ocrServer && ocrServer.rebootBash) {
            //         rebootedAllServers = false
            //         console.log("server to reboot ocrServer wit no mapping", ocrServer)
            //         if (ocrServer.currentStatus === "MAPPING_DOWN" || ocrServer.currentStatus === "NO_MAPPING") {
            //             executeBashScript(ocrServer, "OCR_SERVER")
            //         }
            //     }
            //     ecb() // todo
            // }, cb)
        }
    }, () => {
        console.log("rebootedAllServers", rebootedAllServers)
        if (rebootedAllServers) {
            process.env.REBOOT_ALL_SERVERS = "DISABLED"
        }
        callback(null, true)
    })
}

// set server reboot function will get called once only
function enableBashRebootAllServers() {
    console.log("enableBashRebootAllServers:", process.env.REBOOT_ALL_SERVERS)
    Object.keys(serverStatus).forEach((key) => {
        const server = serverStatus[key]
        if (server && server.sshUP) { // reboot live servers only
            server.rebootBash = true
            // console.log("server to reboot ai", server)
        }
    })
    Object.keys(serverStatusOCR).forEach((key) => {
        const server = serverStatusOCR[key]
        if (server && server.sshUP) { // reboot live servers only
            server.rebootBash = true
            // console.log("server to reboot ocr", server)
        }
    })
    if (process.env.FEEBACK_SERVER_IP) {
        executeBashScript({
            ip: process.env.FEEBACK_SERVER_IP,
            rebootBash: true
        }, "FEEDBACK_SERVER")
    }
    process.env.REBOOT_ALL_SERVERS = "ENABLED"
    console.log("enableBashRebootAllServers after:", process.env.REBOOT_ALL_SERVERS)
}

function holdServer(keyName) {
    //   console.log('HOLD SERVER', keyName)
    if (!keyName) {
        return
    }
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    serverStatus[keyName].currentStatus = 'HOLD';
    serverStatus[keyName]["KEY_VALUE"].currentStatus = "HOLD"
}

function checkServer(ip, port, callback) {
    // const query = `nc -zv ${ip} ${port}`
    // const { port, ip } = getPortAndIp(freeServerIp)
    const command = `nc -zv ${ip} ${port}`;
    if (process.env.NODE_ENV === "test") {
        return callback(null, true)
    }
    exec(command, { timeout: 2000 }, (err, stdout, stderr) => {
        if (stderr.includes('succeeded') && err === null) {
            //   console.log('ilb response from exec', err, 'stdout', stdout, 'stderr', stderr)
            callback(null, true)
        } else if (stderr.includes("failed") && err) {
            // console.log('worked failed', command)
            callback(null, false)
        } else {
            // console.log('worked failed', command)
            callback(null, false)
        }
    })
}

function releaseSnippetServer(keyName) {
    // console.log('discardServer', keyName)
    // console.log('occupyServer', keyName)
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (!serverStatus[keyName]) {
        return
    }
    serverStatus[keyName].SNIPPET.currentStatus = 'FREE';
    serverStatus[keyName].SNIPPET.lastResurrect = new Date().toISOString();

    const payload = {
        serversArray: [keyName],
        serverFlag: 'SNIPPET_RESSURECT'
    }
    sendLBNotification(payload)
}

// Discards SNIPPET TABLE_COMPLETION AUTO_TABLE_COMPLETION FIELD_COMPLETION servers

function discardGeneralServer({ ip: keyName, port, serverType }) {
    // console.log('discardServer', keyName)
    // console.log('occupyServer', keyName)
    if (keyName.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (!serverStatus[keyName]) {
        return
    }
    if (!serverStatus[keyName][serverType]) {
        return
    }
    serverStatus[keyName][serverType].currentStatus = 'UNREACHABLE';
    serverStatus[keyName][serverType].lastUnreachable = new Date().toISOString();
    if (serverType && serverType !== 'SNIPPET') {
        return
    }
    const payload = {
        serversArray: [keyName],
        serverFlag: 'SNIPPET_DOWN'
    }
    // OCR : Server Reboot
    //  KVP : bash /home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/run_kvp.sh
    //  PDF_GEN : bash /home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/run_pdf_gen.sh
    const script = `bash /home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/run_snippet.sh`
    const ip = keyName.split("_")[1]
    console.log('ip to run bash', ip, 'keyName', keyName)
    executeRemoteSSHQuery(script, ip);
    setTimeout(() => {
        checkServer(ip, port, (e, flag) => {
            if (flag) {
                releaseSnippetServer(ip);
            } else {
                const payload = {
                    serversArray: [ip],
                    serverFlag: 'SNIPPET_RESSURECT_FAILURE'
                }
                sendLBNotification(payload)
            }
        })
    }, 1000 * 60 * 5)
    sendLBNotification(payload)
}
module.exports = {
    getServerStatus,
    discardServer,
    resurrectServer,
    getWorkerIpAndPort,
    getFreeServer,
    getDiscardedServers,
    releaseServer,
    getLBUrlForInternalIP,
    occupyServer,
    checkIfWorkerisActive,
    serverStatus,
    getPortAndIp,
    getFreeSnippetServers,
    getFreeTableCompletionServers,
    getFreeAutoTableCompletionServers,
    getFieldCompletionServers,
    getFreeKeyValueExtractionServers,
    getFreePdfGeneratorServers,
    getFreeImageRotatorServers,
    totalActiveServers,
    mappingDown,
    getFreeServerKvp,
    getAllFreeServerKvpCount,
    occupyKvpNormalServer,
    enableBashRebootAllServers,
    checkRebootDone,
    releaseKvpNormalServer,
    holdServer,
    discardGeneralServer
};
