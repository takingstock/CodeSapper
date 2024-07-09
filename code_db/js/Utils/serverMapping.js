const { exec } = require("child_process");
const { eachLimit, auto } = require("async");
const { executeRemoteSSHQuery } = require("./universal-functions.util");
const { serverStatus: loadBalancerAi, serverStatus } = require("./servers")
const { sendEmail: sendNotification } = require('./imc-endpoints.util');

const DEFAULT_PORT = 22
const PORT = {
    OCR_SERVER: 8113,
    AI_SERVER: 7035
}

//const ocrServerStartIpRange = process.env.OCR_SERVER || "10.0.121.x"

const aiServerStartIpRange = process.env.AI_SERVER || "10.0.120.x"
// "MAIN_AI" : 65.1.18.150
// "CORE_OCR" : 35.154.96.253
const serverStatusAi = {}

const serverStatusOCR = {}
if (process.env.GB_INFRA || process.env.NODE_ENV === "scalar") {
    for (let i = (+process.env.AI_SERVER_START_RANGE); i < (+process.env.AI_SERVER_END_RANGE); i++) {
        const aiIp = aiServerStartIpRange.replace('x', i)
        serverStatusAi[`ip_${aiIp}`] = {
            allocated: true,
            'ocrServer': null,
            ip: aiIp,
            lastUnreachable: null,
            lastResurrect: null,
            totalRequestSent: 0,
            sshUP: false,
            ocrPortUp: false,
            currentStatus: 'INITIALIZE', // FREE // BUSY
        }
    }
    // for (let i = (+process.env.OCR_SERVER_START_RANGE); i < (+process.env.OCR_SERVER_END_RANGE); i++) {
    //     const ocrIp = ocrServerStartIpRange.replace('x', i)
    //     serverStatusOCR[`ip_${ocrIp}`] = {
    //         allocated: false,
    //         'aiServer': null,
    //         'childServers': [],
    //         ip: ocrIp,
    //         lastUnreachable: null,
    //         lastResurrect: null,
    //         totalRequestSent: 0,
    //         sshUP: false,
    //         currentStatus: 'INITIALIZE', // FREE // BUSY
    //     }
    // }
}
function getPortAndIp(url) {
    let ip = null;
    let port = null
    if (url.split('/')[0] && url.split('/')[2]) {
        ip = url.split('/')[2].split(':')[0];
        port = url.split('/')[2].split(':')[1];
    }
    return { ip: ip || url, port: port || DEFAULT_PORT }
}

function checkIfWorkerisActive(freeServerIp, serverType, callback) {
    const { ip } = getPortAndIp(freeServerIp)
    const command = `nc -zv ${ip} ${PORT[serverType]}`;
    if (process.env.NODE_ENV === "test") {
        return callback(null, true)
    }
    exec(command, { timeout: 2000 }, (err, stdout, stderr) => {
        if (stderr.includes('succeeded') && err === null) {
            console.log(`server on>>>>${ip} ${PORT[serverType]}`)
            //    console.log('worker ilb response from exec', err, 'stdout', stdout, 'stderr', stderr)
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

function checkOCRMappingUpAndUpdate(singleIP) {
    checkIfWorkerisActive(singleIP, "OCR_SERVER", (err, status) => {
        if (err) {
            console.log('error in ocr active ', err)
        }
        // if (status){
        //     //ocr is up, update the server
        //     if (loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`]){
        //         console.log('mapping down to free',singleIP)
        //         loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`].currentStatus = "FREE"
        //     }else {
        //         console.log('no ai server found for  ',singleIP)
        //     }
        // }else {
        //     console.log('mapping still down for ',singleIP)
        // }
        if (status) {
            // ocr is up, update the server
            console.log("loadBalancerAi singleIP", singleIP)
            console.log("loadBalancerAi", loadBalancerAi[`ip_${singleIP}`])
            if (loadBalancerAi[`ip_${singleIP}`]) {
                console.log('mapping down to free', singleIP)
                loadBalancerAi[`ip_${singleIP}`].currentStatus = "FREE"
            } else {
                console.log('no ai server found for  ', singleIP)
            }
        } else {
            console.log('mapping still down for ', singleIP)
        }
    })
}

process.on('checkOCRMappingUpAndUpdate', function (ipAddress) {
    console.log('checkOCRMappingUpAndUpdate', ipAddress)
    checkOCRMappingUpAndUpdate(ipAddress)
})

function checkIfWorkerAndOCRisActive(freeServerIp, serverType, callback) {
    const { ip } = getPortAndIp(freeServerIp)
    const command = `nc -zv ${ip} ${PORT[serverType]}`;
    const command2 = `nc -zv ${ip} ${PORT['OCR']}`;
    if (process.env.NODE_ENV === "test") {
        return callback(null, true)
    }
    let status = {
        ocr: false,
        ai: false,
    };
    auto({
        'testAI': function (cb) {
            exec(command, { timeout: 2000 }, (err, stdout, stderr) => {
                if (stderr.includes('succeeded') && err === null) {
                    console.log(`server on>>>>${ip} ${PORT[serverType]}`)
                    //    console.log('worker ilb response from exec', err, 'stdout', stdout, 'stderr', stderr)
                    status.ai = true;
                } else if (stderr.includes("failed") && err) {
                    // console.log('worked failed', command)
                } else {
                    // console.log('worked failed', command)
                }
                cb()
            })
        },
        'testOCR': ['testAI', function (res, cb) {
            exec(command2, { timeout: 2000 }, (err, stdout, stderr) => {
                if (stderr.includes('succeeded') && err === null) {
                    console.log(`server on>>>>${ip} ${PORT[serverType]}`)
                    //    console.log('worker ilb response from exec', err, 'stdout', stdout, 'stderr', stderr)
                    status.ocr = true;
                } else if (stderr.includes("failed") && err) {
                    // console.log('worked failed', command)
                } else {
                    // console.log('worked failed', command)
                }
                cb();
            })
        }]
    }, function (err) {
        callback(null, (status.ocr && status.ai))
    })
}

function checkIfOCRisActive(freeServerIp, callback) {
    const { ip } = getPortAndIp(freeServerIp)
    const command2 = `nc -zv ${ip} ${PORT['OCR']}`;
    console.log('checkIfOCRisActive,ip',command2)
    if (process.env.NODE_ENV === "test") {
        return callback(null, true)
    }
    exec(command2, { timeout: 2000 }, (err, stdout, stderr) => {
        if (stderr.includes('succeeded') && err === null) {
            console.log(`server on>>>>${ip} ${PORT['OCR']}`)
                console.log('worker ilb response from exec success', err, 'stdout', stdout, 'stderr', stderr)
            callback(null, true)
        } else if (stderr.includes("failed") && err) {
             console.log('worked failed', command2)
            callback(null, false)
        } else {
             console.log('worked failed', command2)
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
            dataToSend.apiTarget = 'OCR';
            dataToSend.body = `Server Resurrected : <br> Type : ${payload.serverType} <br>${JSON.stringify(payload.serversArray)}`;
        }
        if (payload.serverFlag === 'REBOOTING') {
            dataToSend.subject = `IDP Server Update | REBOOTING | ${NODE_ENV}`;
            dataToSend.apiTarget = 'OCR'
            dataToSend.body = `Server Rebooting: <br> Type : ${payload.serverType} <br>  ${JSON.stringify(payload.serversArray)}`;
        } else {
            // payload.serversArray.forEach(function (remote_ip) {
            //     executeRemoteSSHQuery('sudo reboot',remote_ip)
            // })
        }
        console.log('sending email from servermapping for ', payload.serverFlag, payload.serversArray)
        sendNotification(dataToSend, () => { console.log('Notification Sent') });
    } else {
        //   console.log('IMP_ERROR_sendLBNotification')
    }
}

function shortlistActiveServers(serverStatus, firstRun, serverType, callback) {
    const ipAddress = Object.keys(serverStatus).map(e => e && e.replace("ip_", ''))
    //    console.log('triggered shortlistActiveServers', ipAddress.length);
    eachLimit(ipAddress, 15, (singleIP, cb) => {
        checkIfWorkerAndOCRisActive(singleIP, serverType, (err, isActive) => {
            if (isActive) {
                console.log('serverMapping serversResurrected', singleIP, 'isActive', isActive, 'serverType', serverType)
                if (!serverStatus.hasOwnProperty(`ip_${singleIP}`)) {
                    // was never on
                    // if (!serverStatus[`ip_${singleIP}`]) {
                    //     serverStatus[`ip_${singleIP}`] = {}
                    // }
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    serverStatus[`ip_${singleIP}`].sshUP = true
                    serverStatus[`ip_${singleIP}`].ocrPortUp = true
                    serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString();
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                } else if (serverStatus[`ip_${singleIP}`].currentStatus === 'INITIALIZE') {
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    serverStatus[`ip_${singleIP}`].sshUP = true
                    //    console.log('last stats was INITIALIZE', singleIP)
                } else if (serverStatus[`ip_${singleIP}`].currentStatus === 'UNREACHABLE') {
                    //    console.log('last stats was UNREACHABLE', singleIP)

                    // this server has resurrected
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    serverStatus[`ip_${singleIP}`].sshUP = true
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                    // if (serverType === 'OCR_SERVER') {
                    //     //console.log('${serverStatus[`ip_${singleIP}`].serverStatus', serverStatus)
                    //     console.log('${serverStatus[`ip_${singleIP}`].singleIP', singleIP)
                    //     console.log('${serverStatus[`ip_${singleIP}`].singleIP', loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`])
                    //     if (loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`]){
                    //         loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`].currentStatus = "FREE"
                    //     }else {
                    //         console.log('no ai server found for ocr>>',singleIP)
                    //     }
                    // }
                } else if (serverStatus[`ip_${singleIP}`].currentStatus === 'MAPPING_DOWN') {
                    console.log('last stats was MAPPING_DOWN', singleIP)

                    // this server has resurrected
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    serverStatus['ip_' + singleIP].sshUP = true
                    serverStatus[`ip_${singleIP}`].ocrPortUp = true
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                    serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString()
                    // if (serverType === 'OCR_SERVER') {
                    //     console.log('${serverStatus[`ip_${singleIP}`].serverStatus', serverStatus)
                    //     console.log('${serverStatus[`ip_${singleIP}`].singleIP', singleIP)
                    //     if (loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`].currentStatus === 'MAPPING_DOWN'){
                    //         loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`].currentStatus = "FREE"
                    //     }
                    //
                    // }

                } else if (serverStatus[`ip_${singleIP}`].currentStatus === 'REBOOTING') {
                    console.log('last stats was REBOOTING', singleIP)

                    // this server has resurrected
                    serverStatus[`ip_${singleIP}`].currentStatus = 'FREE';
                    serverStatus['ip_' + singleIP].sshUP = true
                    serverStatus[`ip_${singleIP}`].lastResurrect = new Date().toISOString();
                    serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString()
                    // if (serverType === 'OCR_SERVER') {
                    //     console.log('${serverStatus[`ip_${singleIP}`].serverStatus', serverStatus)
                    //     console.log('${serverStatus[`ip_${singleIP}`].singleIP', singleIP)
                    //     if (loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`].currentStatus === 'MAPPING_DOWN'){
                    //         loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`].currentStatus = "FREE"
                    //     }
                    //
                    // }

                } else {
                    //    console.log('unknown status', singleIP)
                }
            } else {
                if (serverStatus[`ip_${singleIP}`] && serverStatus[`ip_${singleIP}`].currentStatus !== 'REBOOTING') {
                    serverStatus[`ip_${singleIP}`].currentStatus = 'UNREACHABLE';
                    serverStatus[`ip_${singleIP}`].sshUP = false
                    if (!serverStatus[`ip_${singleIP}`].lastUnreachable) {
                        serverStatus[`ip_${singleIP}`].lastUnreachable = new Date().toISOString()
                    }
                }
                // eslint-disable-next-line no-use-before-define
                // if (serverType === "OCR_SERVER" && serverStatus[`ip_${singleIP}`].currentStatus === 'UNREACHABLE') {
                //     checkIfSSHIsUp(singleIP, (err, isActive) => { // 22
                //         if (isActive) {
                //             // const totalRequest = loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`].totalRequest
                //             console.log("loadBalancerAi: ", loadBalancerAi[`ip_${serverStatus[`ip_${singleIP}`].aiServer}`])
                //             console.log('sshIsUpButAppIsDown', singleIP, firstRun)
                //             let timeDiffForSSHUp = 0;
                //             if (serverStatus[`ip_${singleIP}`].lastSSHUP){
                //                 timeDiffForSSHUp = new Date().getTime() - new Date(serverStatus[`ip_${singleIP}`].lastSSHUP).getTime()
                //             }
                //             console.log('timeDiffForSSHUpforAI',timeDiffForSSHUp)
                //             if (!firstRun && timeDiffForSSHUp && timeDiffForSSHUp > (1000 * 60 * 10)){
                //                 console.log('executingRebootforInitialize>>>', singleIP)
                //                 serverStatus[`ip_${singleIP}`].currentStatus = 'REBOOTING';
                //                 const payload = {
                //                     serversArray: [singleIP],
                //                     serverFlag: 'REBOOTING',
                //                     serverType : 'OCR_SERVER'
                //                 }
                //                 sendLBNotification(payload)
                //                 executeRemoteSSHQuery('sudo reboot', singleIP)
                //             }
                //         }
                //         // else {
                //         //     // ssh is also down, remove from list
                //         //     serverStatus['ip_' + singleIP].currentStatus = 'SSH_DOWN';
                //         // }
                //         serverStatus[`ip_${singleIP}`].sshUP = !!isActive;
                //         if (serverStatus[`ip_${singleIP}`].sshUP) {
                //             if (serverStatus[`ip_${singleIP}`].lastSSHUP) {
                //                 //   console.log('lastsshup already set')
                //             } else {
                //                 serverStatus[`ip_${singleIP}`].lastSSHUP = new Date().toISOString()
                //             }
                //         }
                //     })
                // } else {
                //     // todo check rebooting for an hour
                // }
            }
            cb()
        })
    }, callback)
}

// eslint-disable-next-line no-unused-vars
// function mapServers() {
//     let anyServerMappedToAi = false;
//     Object.values(serverStatusAi).forEach(aiServer => {
//         if (!aiServer.allocated && aiServer.sshUP) {
//             const freeServer = Object.values(serverStatusOCR).find(e => !e.allocated && e.sshUP);
//                 console.log('cheking free server', freeServer, 'for', aiServer)
//             if (freeServer) {
//                 freeServer.allocated = true;
//                 freeServer.aiServer = aiServer.ip
//                 aiServer.allocated = true;
//                 aiServer.ocrServer = freeServer.ip
//                 anyServerMappedToAi = true;
//             } else {
//                 aiServer.allocated = false;
//                 aiServer.aiServer = null
//             }
//         }
//         else if (aiServer.allocated && !aiServer.sshUP) {
//             const mappedServer = Object.values(serverStatusOCR).find(e => e.aiServer === aiServer.ip);
//             if (mappedServer) {
//                 mappedServer.allocated = false;
//                 mappedServer.aiServer = null
//                 aiServer.allocated = false;
//                 aiServer.ocrServer = null
//             } else {
//                 aiServer.allocated = false;
//                 aiServer.aiServer = null
//             }
//         }
//         else if (aiServer.allocated && aiServer.sshUP) {
//             const mappedServer = Object.values(serverStatusOCR).find(e => e.aiServer === aiServer.ip);
//             //mappedServer sshup should be up, if down, then remove this mapping
//             if (mappedServer.sshUP){
//                 //all good
//             }else {
//                 mappedServer.allocated = false;
//                 mappedServer.aiServer = null
//                 aiServer.allocated = false;
//                 aiServer.ocrServer = null
//                 console.log('mapped server went down, clearing mapping',aiServer,mappedServer)
//                 if (loadBalancerAi[`ip_${aiServer.ip}`]){
//                     loadBalancerAi[`ip_${aiServer.ip}`].currentStatus = "NO_MAPPING"
//                 }
//
//             }
//         }
//     })
//     if (anyServerMappedToAi){
//         process.emit('startShortlistActiveRunning')
//     }
//     //    console.log("after mapping serverStatusAi: free  ", Object.values(serverStatusAi).filter(e => e.currentStatus === 'FREE').length)
//     //    console.log("after mapping serverStatusAi: SSH_DOWN ", Object.values(serverStatusAi).filter(e => e.currentStatus === 'SSH_DOWN').length)
//     //    console.log("after mapping serverStatusAi: INITIALIZE ", Object.values(serverStatusAi).filter(e => e.currentStatus === 'INITIALIZE').length)
//
//     // console.log("after mapping serverStatusAi: ", JSON.stringify(serverStatusAi))
// }

const mappedAiServers = () => {
    const aiServers = Object.values(serverStatusAi).filter(e => e.allocated)
    const servers = aiServers.map(s => ({
        aiServer: s.ip,
        coreOCRServer: s.ocrServer,
        childServers: []
    }))
    return servers
}

// eslint-disable-next-line no-unused-vars
function startShortListingServers(callback) {
    console.log('startShortListingServers in server mapping')
    auto({
        ai: (cb) => {
            shortlistActiveServers(serverStatusAi, false, "AI_SERVER", (err) => {
                for (const key in serverStatusAi) {
                    if (serverStatusAi[key].currentStatus === 'FREE') {
                        //    console.log('free ai server', serverStatusAi[key])
                    }
                }
                cb(err)
            })
        },
        ocr: ['ai', (_, cb) => {
            return cb();
            // shortlistActiveServers(serverStatusOCR, false, "OCR_SERVER", (err) => {
            //     for (const key in serverStatusOCR) {
            //         if (serverStatusOCR[key].currentStatus === 'FREE') {
            //             //    console.log('free ocr server', serverStatusOCR[key])
            //         }
            //     }
            //     cb(err)
            // });
        }]
    }, callback)
}

startShortListingServers(() => {
    //mapServers()
    // console.log("mappedAiServers() initial", mappedAiServers())
})
if (process.env.GB_INFRA || process.env.NODE_ENV === "scalar") {
    setInterval(() => {
        startShortListingServers(() => {
            //mapServers()
            // console.log("mappedAiServers() interval", mappedAiServers())
        })
    }, 60 * 1000) // every 1 min
}

const getAiServerMappingDetails = (aiIp) => {
    return true;
    // let validMapping = true
    // const ai = serverStatusAi[`ip_${aiIp}`];
    // console.log("getAiServerMappingDetails:", ai)
    //
    // if (ai && ai.allocated) {
    //     //console.log('all serverStatusOCR',serverStatusOCR)
    //     const ocr = serverStatusOCR['ip_' + ai.ocrServer] || {};
    //     console.log('ocr', ocr)
    //     // if (ocr.currentStatus !== "FREE" && ai.currentStatus !== "FREE") {
    //     //     ocr.allocated = true;
    //     //     ocr.aiServer = null
    //     //     ai.allocated = false;
    //     //     ai.ocrServer = null;
    //     //     validMapping = false;
    //     // }
    //     console.log("getAiServerMappingDetails loadbalancer", loadBalancerAi[`ip_${aiIp}`])
    //     console.log("ocr.currentStatus", ocr.currentStatus)
    //     if (ocr.currentStatus === "UNREACHABLE" || ocr.currentStatus === "REBOOTING") {
    //         loadBalancerAi[`ip_${aiIp}`].currentStatus = "MAPPING_DOWN"
    //         validMapping = false // wait for mapping
    //     }
    // } else {
    //     validMapping = false // wait for mapping
    // }
    // if (!validMapping) {
    //     startShortListingServers(() => {
    //         console.log("ocr server down for ai server started remaping")
    //     })
    // }
    // return validMapping
}
module.exports = {
    mappedAiServers,
    serverStatusAi,
    serverStatusOCR,
    getAiServerMappingDetails,
    checkIfServerIsActive: checkIfWorkerisActive
}
