const { eachLimit } = require("async");
const { cpuUtilization } = require('./ai-endpoints.util')
const { getPortAndIp, serverStatus } = require("./load-balancer")

const checkAiServersCpuUtilization = (callback) => {
    const defaultUrl = process.env.CPU_UTILIZATION_API
    if (!defaultUrl) {
        return callback()
    }
    const { ip } = getPortAndIp(defaultUrl)
    const serversArray = Object.values(serverStatus).filter(s => s.sshUP)
    const limit = serversArray.length
    if (!limit) {
        return callback()
    }
    eachLimit(serversArray, limit, (server, cb) => {
        const url = defaultUrl.replace(ip, server.ip);
        cpuUtilization({ url }).then(r => {
            server.cpu = r.cpu
            return cb()
        })
    }, callback)
}
module.exports = {
    checkAiServersCpuUtilization
};
