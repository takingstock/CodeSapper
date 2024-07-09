const config = require('config');
const { auto, eachSeries } = require("async");
const CELL_INFO_META = require("../Models/cellinfoMetaData.model")
const CELL_INFO_META_HISTORY = require("../Models/cellinfoMetaDataHistory.model")

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');

const fetchCellInfo = (user, params, callback) => {
    auto({
        cellInfoMeta: (cb) => {
            CELL_INFO_META.find({ pageId: params.pageId }, cb);
        },
        cellInfoMetaHistory: (cb) => { // for hardReset docs
            CELL_INFO_META_HISTORY.find({ pageId: params.pageId }, cb);
        },
        cellInfoMetaData: ["cellInfoMeta", "cellInfoMetaHistory", ({ cellInfoMeta, cellInfoMetaHistory }, cb) => {
            return cb(null, cellInfoMeta && cellInfoMeta[0] && cellInfoMeta) || cellInfoMetaHistory
        }]
    }, (e, { cellInfoMetaData }) => {
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: cellInfoMetaData });
    })
}
const updateCellInfo = (data, callback) => {
    eachSeries(Object.keys(data), (pageId, ecb) => {
        CELL_INFO_META.findOneAndUpdate({ pageId }, { $set: data }, { upsert: true }, ecb);
    }, (e) => {
        if (e) {
            console.log("errorupdateCellInfo: ", e)
        }
        callback(e, true);
    })
}
const deleteCellInfo = (pageIds, callback) => {
    auto({
        removeCellInfoMeta: (cb) => {
            if (pageIds.length) {
                CELL_INFO_META.deleteMany({ pageId: { $in: pageIds } }, cb);
            } else {
                cb()
            }
        }
    }, (e) => {
        if (e) {
            console.log("errorupdateCellInfo: ", e)
        }
        callback(e, true);
    })
}
module.exports = {
    fetchCellInfo,
    updateCellInfo,
    deleteCellInfo
}
