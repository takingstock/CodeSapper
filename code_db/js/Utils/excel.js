const excel = require('excel4node');
const path = require('path');
const fs = require('fs');
const fsXtra = require('fs-extra');
const { auto, eachSeries } = require('async');
const excelToJson = require('convert-excel-to-json');
const { VendorsService } = require('../Services');

const _pathToDownloads = path.join(__dirname, '../../', '/uploads/downloads');

const readVendorXcelFile = (pathDir, callback) => {
    // let pathDir = `${_pathToDownloads}`;
    let resultInJson = []
    let readFilee = true
    const limitReadLines = 20000
    console.log("pathDir:::", pathDir)
    const startRows = []
    if (!pathDir || !pathDir.length) {
        callback("pathDir is empty")
    } else {
            for (let row = 1; row < 1000000; row += limitReadLines) {
                startRows.push(row)
            }
            eachSeries(startRows, (row, esb) => {
                if (!readFilee) return esb()
                auto({
                    readFiles: (cb) => {
                        if (readFilee) {
                            resultInJson = excelToJson({
                                sourceFile: pathDir,
                                range: `A${row}:E${row + limitReadLines - 1}`,
                                sheets: [`Sheet1`],
                                sheetStubs: true,
                                columnToKey: {
                                    A: 'customerId',
                                    B: 'vendorId',
                                    C: 'vendorName',
                                    D: 'vendorAddress',
                                    E: 'columnType'
                                }
                            });
                            // console.log("resultinjson:", resultInJson, `A${row}:D${row + limitReadLines - 1}`)
                        } else {
                            console.log("inside else resultinjson")
                            resultInJson = []
                        }
                        cb(null, resultInJson)
                    },
                    insertToDB: ["readFiles", (res, cb) => {
                        if (resultInJson && resultInJson["Sheet1"] && !resultInJson["Sheet1"].length) {
                            console.log("no resultInJson")
                            readFilee = false
                            return cb()
                        }
                        console.log("inserting row ", row, " to ", row + limitReadLines - 1)
                        console.log("inside insertToDB")
                        // for (const eachSheet of Object.keys(resultInJson)) {
                            VendorsService.createMany(resultInJson["Sheet1"], (err) => {
                                if (err) {
                                    console.log("error while inserting into vendor table", err)
                                } else {
                                    console.log("successfully inserted array to db: Sheet1")
                                }
                                cb()
                            })
                        // }
                    }],
                }, (err) => {
                    console.log("readVendorXcelFile error: ", err);
                    // resolve(res.readFiles);
                    esb()
                })
            }, (err) => {
                if (err) {
                    console.error("read vendor error::", err)
                    return callback(err)
                }
                callback()
            })
        }
}

const saveXcelFile = (data, fileurl, callback) => {
    // data=[{data:[{A:"dfa",B:"dfa"},{A:"dfasd",B:"eaef"}],type},{data:[],type}]
    // Create a new instance of a Workbook class
    if (!data || !data.length) {
        callback(null, "NO data to procdess for sheet");
    } else {
        const workbook = new excel.Workbook();
        data.forEach((doc) => {
            // Add Worksheets to the workbook
            const worksheet = workbook.addWorksheet(doc.type);
            const document = doc.data;
            // Style for headers
            const style = workbook.createStyle({
                font: {
                    color: '#EA3A14',
                    size: 18
                },
                numberFormat: '$#,##0.00; ($#,##0.00); -'
            });

            const styleForData = workbook.createStyle({
                font: {
                    color: '#47180E',
                    size: 12
                },
                alignment: {
                    wrapText: true,
                    horizontal: 'center',
                },
                numberFormat: '$#,##0.00; ($#,##0.00); -'
            });
            // Tab 1 headers
            Object.keys(document[0] || []).forEach((k, j) => {
                worksheet.cell(1, 1 + j).string(k).style(style);
            });
            // Some logic
            function generateExcelSheet(array, workshet) {
                let row = 2; // Row starts from 2 as 1st row is for headers.
                for (const i in array) {
                    const o = 1;
                    // This depends on numbers of columns to fill.
                    Object.keys(array[i]).forEach((k, j) => {
                        // console.log("array[i][k] === karray[i][k] === k", array[i][k], k);
                        // array[i][k] === k ? style : styleForData
                        workshet.cell(row, o + j).string(array[i][k] || '').style(styleForData);
                    });
                    row += 1;
                }
            }
            generateExcelSheet(document, worksheet);
        });
        // generateExcelSheet(sellOrderTypes, worksheet1);
        fs.unlink(fileurl, (err) => {
            if (err) { console.log("UNLINK FS", err) }
            workbook.write(fileurl, (err) => {
                if (err) {
                    callback(err);
                }
                callback(null, "EXCEL file save sucessfully");
            });
        })
    }
};

/**
 * Create excel file
 * @param {*} data
 * @param {*} batchId
 * @returns { Promise<any> }
 */
const createXcelFile = (data, batchId) => new Promise((resolve) => {
    let pathDir = `${_pathToDownloads}`;
    try {
        auto({
            ensureDir: (cb) => {
                fsXtra.ensureDir(pathDir, cb);
            },
            saveFile: ['ensureDir', (_, cb) => {
                pathDir = `${pathDir}/${batchId}.xlsx`;
                saveXcelFile(data, pathDir, cb);
            }]
        }, (err, res) => {
            console.log("success", err, res);
            resolve(res);
        });
    } catch (e) {
        console.log("ensureDirensureDir", e)
        resolve(true)
    }
});

module.exports = {
    createXcelFile,
    readVendorXcelFile,
};
