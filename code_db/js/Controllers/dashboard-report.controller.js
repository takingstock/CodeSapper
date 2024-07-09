const config = require('config');

const async = require("async");
const fs = require("fs");
const moment = require('moment-timezone');
const path = require('path');
const XLSX = require('xlsx');
const { createXcelFile } = require('../Utils/excel');

const HOST = config.get("HOST")
const { VendorsService } = require('../Services');

const _pathToDownloads = path.join(__dirname, '../../', '/uploads/downloads');
const FINAL_REPORT_DIR = `${process.env.HOME}/shared_folder_between_apps/idp_backend/reports/`

const dashboardReport = (callback) => {
  const formattedDataArray = [
    // {
    // "SNo": "SNo",
    // "Customer Id": "Customer Id",
    // "Vendor Id": "Vendor Id",
    // "Vendor Name": "Vendor Name",
    // "Vendor Address": "Vendor Address" }
  ];
  let vendorListArray = []

  async.auto(
    {
      getConversationData: (cb) => {
        const option = {
          lean: true,
          // limit: 10
        };

        VendorsService.findAll({}, {}, option, (err, result) => {
          if (err) {
            console.error("conversationService.get err:", err);
            cb(err);
          } else {
            vendorListArray = result || [];
          }
          cb();
        });
      },

      formatData: [
        "getConversationData",
        (res, cb) => {
          let sNo = 0;

          for (const vendor of vendorListArray) {
            sNo += 1;
            const formattedObj = {
              SNo: `${sNo}`,
              "Customer Id": `${vendor.customerId || ""}`,
              "Vendor Id": `${vendor.vendorId || ""}`,
              "Vendor Name": `${vendor.vendorName || ""}`,
              "Vendor Address": `${vendor.vendorAddress || ""}`,
            };
            formattedDataArray.push(formattedObj);
          }
          cb();
        },
      ],
    },
    (err) => {
      if (err) {
        callback(err);
      } else {
        callback(null, formattedDataArray);
      }
    }
  );
};

const createDashboardReportXls = (callback) => {
  let formattedDataArray = [];
  let fileName = "";
  let lastEntryDate = null
  async.auto(
    {
      getLastEntryDate: (cb) => {
        VendorsService.findOne({}, { createdAt: 1 }, { sort: { createdAt: -1 }, limit: 1 }, (err, result) => {
          if (err) {
            cb(err)
          }
          if (result) {
            lastEntryDate = moment(result.createdAt).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm::ss")
            console.log(lastEntryDate)
          }
          cb()
        })
      },
      getDataFromDB: [
        "getLastEntryDate",
        (res, cb) => {
          dashboardReport((err, result) => {
            if (err) {
              cb(err);
            } else {
              formattedDataArray = result || [];
              console.log("formatted data length:", formattedDataArray.length)
              cb();
            }
          });
        },
      ],

      createXls: [
        "getDataFromDB",
        (res, cb) => {
          if (!formattedDataArray.length) return cb()
          const batchName = `vendorList${lastEntryDate}`
          const exclData = [{ data: formattedDataArray, type: "vendors" }]
          createXcelFile(exclData, batchName).then((res) => {
            console.log(res)
            const filenamme = `vendorListLatest.xlsx`;
            const filePath = `${_pathToDownloads}/${filenamme}`;
            const workBook = XLSX.readFile(`${_pathToDownloads}/${batchName}.xlsx`);
            XLSX.writeFile(workBook, filePath, { bookType: "xlsx" });
            fileName = `${process.env.BACKEND_HOST || HOST[process.env.NODE_ENV]}downloads/${batchName}.xlsx`
            // fileName = `${HOST.development}downloads/vendorList.xlsx`
            console.log("filename:", fileName)
            const response = {
              "statusCode": 200,
              "message": "Success",
              "type": "DEFAULT",
              "data": fileName
            }
            cb(null, response)
          })
        },
      ],
    },
    (err, res) => {
      if (err) {
        callback(err);
      } else {
        callback(null, res.createXls);
      }
    }
  );
};

const getLatestVendorList = (callback) => {
  async.auto(
    {
      getLastSavedFile: (cb) => {
        const fileNameLocal = `${_pathToDownloads}/vendorListLatest.xlsx`
        const fileName = `${process.env.BACKEND_HOST || HOST[process.env.NODE_ENV]}downloads/vendorListLatest.xlsx`
        if (fs.existsSync(fileNameLocal)) {
          cb(null, {
            "statusCode": 200,
            "message": "Success",
            "type": "DEFAULT",
            "data": fileName
          })
        } else {
          createDashboardReportXls((err, result) => {
            if (err) {
                cb("createDashboardReportXls err:", err)
            }
            cb(null, result);
        })
        }
    },
    },
    (err, res) => {
      if (err) {
        callback(err);
      } else {
        callback(null, res.getLastSavedFile);
      }
    }
  );
};

const downloadReport = (payload, callback) => {
  const filePath = `${FINAL_REPORT_DIR}${payload.fileName}`;

  if (fs.existsSync(filePath)) {
    callback(null, {
      filePath,
      fileName: payload.fileName,
    });
  } else {
    callback(config.get('STATUS_MSG.ERROR.FILE_UPLOAD.FILE_NOT_FOUND'));
  }
};

module.exports = {
  downloadReport,
  dashboardReport,
  createDashboardReportXls,
  getLatestVendorList
};
