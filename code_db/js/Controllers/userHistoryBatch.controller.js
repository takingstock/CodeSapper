const { auto } = require('async');
const USER_HISTORY_BATCH = require("../Models/userHistoryBatch.model")

const createUserAction = (data, callback) => {
    console.log("createUserAction:: ", data)
    auto({
        create: (cb) => {
            const dataToCreate = data
            new USER_HISTORY_BATCH(dataToCreate).save(cb)
        }
    }, callback)
}

module.exports = {
    createUserAction
};
