const config = require('config');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const ENV_CONFIG = require('../Models/env-config.model')

const fetchConfiguration = (callback) => {
    ENV_CONFIG.findOne({}, (e, data) => {
        if (e) {
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data })
    })
}

const updateConfiguration = (payload, callback) => {
    ENV_CONFIG.findOneAndUpdate({ _id: payload._id }, { $set: payload }, { new: true }, (e, data) => {
        if (e) {
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data })
    })
}
const createConfiguration = (payload, callback) => {
    ENV_CONFIG.findOne({}, (e, r) => {
        if (!e && !r) {
            new ENV_CONFIG(payload).save(callback)
        } else {
            console.log("config already present")
            return callback()
        }
    })
}
createConfiguration({
    defaultServerMapping: {
        aiServer: "10.13.0.8",
        coreOCRServer: "10.13.0.6",
        childServers: []
    }
}, (e, r) => {
    console.log("createConfiguration bootstrap", e, r);
})
module.exports = {
    fetchConfiguration,
    updateConfiguration
}
