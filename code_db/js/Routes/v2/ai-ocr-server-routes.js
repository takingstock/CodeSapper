const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');

const { serverStatusOCR } = require("../../Utils/serverMapping")
const { serverStatus: serverStatusAi, releaseServer, holdServer, releaseKvpNormalServer } = require("../../Utils/load-balancer")
const { executeRemoteSSHQuery } = require("../../Utils/universal-functions.util");

const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const V2 = config.get('API.V2');

const fetchAiServers = (request) => {
    const { serverStatus } = request.query;
    let servers = []
    if (serverStatus) {
        servers = Object.values(serverStatusAi).filter(e => {
            let flag = false
            switch (serverStatus) {
                case 'SSH_UP':
                    flag = e.sshUP;
                    break
                case 'SSH_DOWN':
                    flag = !e.sshUP;
                    break
                default:
                    flag = e.currentStatus === serverStatus;
            }
            return flag
        })
    } else {
        servers = Object.values(serverStatusAi)
    }
    return ({ ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: servers })
}

const fetchOcrServers = (request) => {
    const { serverStatus } = request.query;
    let servers = []
    if (serverStatus) {
        servers = Object.values(serverStatusOCR).filter(e => {
            let flag = false
            switch (serverStatus) {
                case 'SSH_UP':
                    flag = e.sshUP;
                    break;
                case 'SSH_DOWN':
                    flag = !e.sshUP;
                    break;
                case 'ALLOCATED':
                    flag = e.allocated;
                    break;
                case 'NOT_ALLOCATED':
                    flag = !e.allocated;
                    break;
                default:
                    flag = e.currentStatus === serverStatus;
            }
            return flag
        })
    } else {
        servers = Object.values(serverStatusOCR)
    }
    return ({ ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: servers })
}

const changeServerStatus = (request) => {
    const { ip, serverStatus = "FREE" } = request.payload
    console.log("request.payload", request.payload)
    let keyName = ip
    if (ip.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }
    if (!serverStatusAi[keyName]) {
        return ({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Ip address not available" });
    }
    if (serverStatus === "FREE") {
        releaseServer(ip)
        releaseKvpNormalServer(ip)
    } else {
        holdServer(ip)
    }
    return (HTTP_SUCCESS_MESSAGES.DEFAULT)
}

const rebootServer = (request) => {
    const { ip, serverType } = request.payload
    console.log("request.payload", request.payload)
    let keyName = ip
    let selectedServer = null
    if (ip.includes('_')) {
        // ok
    } else {
        keyName = `ip_${keyName}`
    }

    if (serverType === "AI") {
        selectedServer = serverStatusAi[keyName]
    }
    if (serverType === "OCR") {
        selectedServer = serverStatusOCR[keyName]
    }
    if (!selectedServer) {
        return ({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Ip address not available" });
    }
    selectedServer.currentStatus = 'REBOOTING';
    selectedServer.lastReboot = new Date().toISOString()
    selectedServer.totalReboots++
    // const payload = {
    //     serversArray: [singleIP],
    //     serverFlag: 'REBOOTING',
    //     serverType: 'AI_SERVER'
    // }
    // sendLBNotification(payload)
    console.log("EXecuting rebooot for server", selectedServer)
    executeRemoteSSHQuery('sudo reboot', selectedServer.ip)
    return (HTTP_SUCCESS_MESSAGES.DEFAULT)
}
module.exports = [{
    method: 'GET',
    path: `${V2}status/aiServers`,
    handler: fetchAiServers,
    options: {
        validate: {
            query: Joi.object({
                serverStatus: Joi.string().valid('INITIALIZE', 'FREE', 'SSH_UP', 'SSH_DOWN', 'BUSY', 'UNREACHABLE', 'REBOOTING').optional(),
            })
        },
        description: 'List aiServers',
        tags: ['Server status', 'api'],
    }
},
{
    method: 'GET',
    path: `${V2}status/ocrServers`,
    handler: fetchOcrServers,
    options: {
        validate: {
            query: Joi.object({
                serverStatus: Joi.string().valid('INITIALIZE', 'FREE', 'SSH_UP', 'SSH_DOWN', 'ALLOCATED', 'NOT_ALLOCATED', 'UNREACHABLE', 'REBOOTING').optional(),
            })
        },
        description: 'List ocrServers',
        tags: ['Server status', 'api'],
    }
},
{
    method: 'PATCH',
    path: `${V2}status/aiServer`,
    handler: changeServerStatus,
    options: {
        validate: {
            payload: Joi.object({
                ip: Joi.string().required(),
                serverStatus: Joi.string().valid('FREE', 'HOLD').optional(),
            })
        },
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: SUPER_ADMIN,
                }
            ]
        },
        description: 'changes ai Server Status',
        tags: ['Server status', 'api'],
    }
},
{
    method: 'PATCH',
    path: `${V2}server/reboot`,
    handler: rebootServer,
    options: {
        validate: {
            payload: Joi.object({
                ip: Joi.string().required(),
                serverType: Joi.string().valid('AI', 'OCR').required(),
            })
        },
        auth: {
            strategy: AUTH_STRATEGIES.API_AUTH,
            access: [
                {
                    scope: SUPER_ADMIN,
                }
            ]
        },
        description: 'reboot server',
        tags: ['Server status', 'api'],
    }
}
];
