const { auto } = require("async")

const AI_API_LOG = require("../Models/ai-api-log.model");

const createLog = (data, callback) => {
    const payload = {
        response: data.response,
        isError: data.isError,
        payload: data.payload,
        url: data.url,
        apiType: data.apiType,
        requestTime: data.requestTime,
        responseTime: data.responseTime
    }
    auto({
        addLog: (cb) => {
            AI_API_LOG.create(payload, cb)
        }
    }, callback)
}
module.exports = {
    createLog
}
