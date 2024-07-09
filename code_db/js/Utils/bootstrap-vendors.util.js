const excelToJson = require('convert-excel-to-json');
const async = require("async");
const { VendorsService } = require('../Services');

const bootstrapVendorToDb = () => new Promise(resolve => {
    console.log("STARTING DB BOOTSTRAP")
    let result = {}
    const filePath = './VendorList.xlsx'
    VendorsService.findOne({}, null, null, (err, vendor) => {
        if (err || vendor) {
            console.log("vendor bootstraping err", err)
            return resolve(true)
        }
            async.eachSeries([2, 3, 4, 5], (i, ecb) => {
                async.auto({
                    readFile: (cb) => {
                        console.log("inside readFile")
                        result = excelToJson({
                            sourceFile: filePath,
                            sheets: [`Sheet${i}`],
                            columnToKey: {
                                A: 'customerId',
                                B: 'vendorId',
                                C: 'vendorName',
                                D: 'vendorAddress',
                            }
                        });
                        cb()
                    },
                    insertToDB: ["readFile", (res, cb) => {
                        console.log("inside insertToDB")
                        // for (const eachSheet of Object.keys(result)) {
                            async.eachSeries(Object.keys(result), (eachSheet, icb) => {
                                VendorsService.createMany(result[eachSheet], (err) => {
                                    if (err) {
                                        console.log("error while inserting into vendor table", err)
                                    } else {
                                        console.log("successfully inserted array to db:", eachSheet)
                                    }
                                    icb()
                                })
                            }, () => {
                                cb()
                            })
                    }],
                }, err => {
                    if (err) {
                        console.log(err)
                    }
                    ecb()
                })
            }, () => {
                return resolve(true)
            })
    })
});

module.exports = {
    bootstrapVendorToDb,
};
