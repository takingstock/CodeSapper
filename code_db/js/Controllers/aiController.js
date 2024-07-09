/* eslint-disable no-eval */
// const async = require('async');
const moment = require("moment-timezone");
// const moment = require("moment");
const Services = require('../Services')

const fetchData = (payload, callback) => {
    console.log(payload.criteria);
    const criteria = payload.criteria
    if (payload.criteria) {
        if (criteria.createdAt) {
            for (const [key, value] of Object.entries(criteria.createdAt)) {
                console.log(`${key}: ${value}`);
                criteria.createdAt[key] = moment.tz(value, "YYYY-MM-DD", "Asia/Kolkata")
                    .add(1, 'days')
                    .toISOString();
            }
        }
    }
    const options = payload.options
    console.log("options:==>", options)
    console.log("OPTIONS", options)
    const projection = {}
    if (payload.projection) {
        const tempProjection = payload.projection.replace(/['"]+/g, '').split(',')
        for (let i = 0; i < tempProjection.length; i++) {
            projection[tempProjection[i]] = 1
        }
    }
    // console.log("projection: ==>", projection)
    Services[payload.tableName].findAll(payload.criteria, projection, options, (err, response) => {
        if (err) {
            console.log("Err==>", err)
            return callback(err);
        }
        return callback(null, response);
    });
}

const countData = (payload, callback) => {
    let criteria = {}
    if (payload.criteria) {
        criteria = payload.criteria
    }
    console.log("countData", criteria)
    Services[payload.tableName].count(criteria, (err, result) => {
        if (err) {
            return callback(err);
        }
        let response = null;
        if (result > 1) {
            response = `TOTAL NO OF ENTRIES ALIGNING WITH THE PROVIDED CRITERIA ARE ${result}`
        } else {
            response = `TOTAL NO OF ENTRIES ALIGNING WITH THE PROVIDED CRITERIA IS ${result}`
        }
        return callback(null, response);
    });
}

// const updateData = (payload, callback) => {

//     let criteria = payload.criteria
//     let dataToSet = payload.updateData

//     aiService.update(criteria,dataToSet ,{ lean: true }, (err, result)=>{
//         if(err){
//             return callback(APP_CONSTANTS.ERROR.INVALID_USER_PASS)
//         }
//         else{
//             callback(null, result)
//         }
//     })

// }

// const deleteData  = (payload, callback) => {

//     let criteria = payload.criteria

//     aiService.deleteOne(criteria, (err, result)=>{
//         if(err){
//             return callback(APP_CONSTANTS.ERROR.INVALID_USER_PASS)
//         }
//         else{
//             callback(null, result)
//         }
//     })

// }

module.exports = {
    fetchData,
    countData,
    // updateData,
    // deleteData
};
