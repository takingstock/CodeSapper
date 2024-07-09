const moment = require('moment');
const config = require('config');
const { auto } = require('async');
const CONSOLE = require('../Utils/console-log.util');
const { _customiseDocumentsForProcessing, _processAiOnDocuments, releaseUnnecessaryFileLock } = require('../Helpers/cron');
const WorkFlowDataHelper = require('../Helpers/workflow');
const { documentService, idpService } = require('../Services');
const { startOcrProcess } = require("../Utils/ocr.util")
const { startRotatedFileOcrProcess, startKvpFileProcess } = require("../Utils/ocrRotatedImages.util")
const { checkAlerts } = require('../Utils/checkForAlerts');

const { startPurgingFiles } = require('../Utils/S3')
const { startKeyValueExtract, imageRotater, startPdfGenerator } = require('../Utils/document-classification.util')
// const { generateDailyReports, getDailyStats } = require('./reports.controller')
const { executeDiskSpaceCheck } = require('../Helpers/disk-alert')
const { checkRebootDone, enableBashRebootAllServers } = require('../Utils/load-balancer')
const { checkAiServersCpuUtilization } = require('../Utils/performance.utils')
const { createQueueLogs, checkLastTenFilesAvgTime } = require("./queueController")
const { autoScheduler } = require("./admin-dashboard.controller")
const { startArchive } = require('../Utils/archive-collections.util')
const { readReportTickets, generateDailyReports, getDailyStats } = require("./latest-reports.controller")

const AI_STATUS = config.get('AI_STATUS');
const CRON_DELAY_TIME = config.get('SERVER.CRON_DELAY_TIME');
const CRON_DOCS_TO_PROCESS_PER_BATCH = config.get('SERVER.CRON_DOCS_TO_PROCESS_PER_BATCH');
let IS_BATCH_OCR_QUEUE_EMPTY = false;
let IS_BATCH_FEEDBACK_QUEUE_EMPTY = false;
let IS_PURGING_QUEUE_EMPTY = false;
let IS_KEY_VALUE_EXTRACT_QUEUE_EMPTY = false
let IS_KEY_VALUE_EXTRACT_NORMAL_QUEUE_EMPTY = false
let IS_KEY_VALUE_EXTRACT_ROTATED_QUEUE_EMPTY = false
let IS_PDF_GENERATOR_QUEUE_EMPTY = false
let IS_IMAGE_ROTATOR_QUEUE_EMPTY = false
let IS_FILE_LOCK_QUEUE_EMPTY = false;
let IS_READ_REPORT_TICKET_EMPTY = false;
let ipOcrLock = false;
let REBOOT_CHECK = false
const serverRestartedAt = new Date()
let DATA_ARCHIVED_AT = null;
const DATA_HELPERS = {
  /** not use anymore */
  _documentsExtractViaAI: (hcb) => {
    auto({
      UNPROCESS_DOCUMENTS: (cb) => {
        const aiStatusCheck = [AI_STATUS.FEEDBACK_PENDING]
        if (!ipOcrLock) {
          aiStatusCheck.push(AI_STATUS.OCR_PENDING)
        }
        documentService.findAll({
          configId: { $ne: null },
          isDeleted: false,
          aiStatus: { $in: aiStatusCheck },
        }, {}, { limit: CRON_DOCS_TO_PROCESS_PER_BATCH }).then((result) => {
          if (result && result.length) {
            cb(null, result)
          } else {
            cb("no data to process");
          }
        }).catch(err => cb(err));
      },
      mappedUnprocessedDocuments: ['UNPROCESS_DOCUMENTS', (result, cb) => {
        _customiseDocumentsForProcessing(result.UNPROCESS_DOCUMENTS).then((result) => {
          if (result && result.length) {
            cb(null, result)
          } else {
            cb("no data to process")
          }
        }).catch(err => cb(err));
      }],
    }, (err, { mappedUnprocessedDocuments }) => {
      if (err) {
        return hcb(err);
      }
      if (mappedUnprocessedDocuments && mappedUnprocessedDocuments.length) {
        CONSOLE.info(`No of documents processing with AI on ${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}: ${mappedUnprocessedDocuments.length} `);
        _processAiOnDocuments(mappedUnprocessedDocuments).then(result => {
          hcb(null, result)
        }).catch(err => hcb(err));
      }
    })
  },
  // _batchExtractViaAI: async (cb) => {
  //   const BATCHES = await idpService.findAll({ workflowId: { $ne: null }, isDeleted: false, step: { $in: [0, 1] } },
  //     { batchId: 1, workflowId: 1, filesCount: 1, ocrPassedCount: 1, ocrFailedCount: 1, step: 1 },
  //     { limit: CRON_DOCS_TO_PROCESS_PER_BATCH });
  //   if (BATCHES.length) {
  //     await WorkFlowDataHelper.executeInSeries(BATCHES, cb);
  //   }
  //   cb(null, true)
  // },
  _batchExtractViaAI: (callback) => {
    const stepCheck = [1, 2];
    auto({
      getBatches: (cb) => {
        idpService.findAll({ workflowId: { $ne: null }, isDeleted: false, step: { $in: stepCheck } },
          { batchId: 1, workflowId: 1, filesCount: 1, ocrPassedCount: 1, ocrFailedCount: 1, step: 1 },
          { limit: CRON_DOCS_TO_PROCESS_PER_BATCH }, cb);
      },
      executeBatch: ['getBatches', ({ getBatches }, cb) => {
        if (getBatches.length) {
          console.log('executeBatch.length', getBatches.length)
          WorkFlowDataHelper.executeInSeries(getBatches, cb);
        } else {
          // console.log("No batches found")
          cb(null, true);
        }
      }]
    }, callback);
  },
};

const initAiProcess = (cronJob = false) => {
  // return flag;
  console.log("INIT CRON AI PROCESSS cronJob", cronJob)
  let REBOOT_AI_OCR_SERVERS = false
  let lastMinute = null
  if (cronJob) {
    setInterval(() => {
      const curr_time = moment().tz(process.env.TIME_ZONE || "America/Chicago").format("HH:mm:ss");
      const currentDay = moment().tz(process.env.TIME_ZONE || "America/Chicago").day()
      const time = curr_time.split(":")
      const hours = parseInt(time[0], 10)
      const minutes = parseInt(time[1], 10)
      const seconds = parseInt(time[2], 10)
      // let MAINTENANCE = hours === 23 && minutes >= 0 && minutes <= 30
      let MAINTENANCE = hours === 0 && minutes >= 0 && minutes <= 30

      // TODO uncomment for prod deployment
      if (process.env.NODE_ENV_LABEL === "MARK_PROD" && MAINTENANCE) {
        // if (MAINTENANCE) {
        console.log("SERVER IN MAINTENANCE time", curr_time)
        process.env.MAINTENANCE = "ENABLED"
      } else {
        process.env.MAINTENANCE = "DISABLED"
        MAINTENANCE = false
        REBOOT_AI_OCR_SERVERS = false
      }
      if (process.env.NODE_ENV_LABEL === "MARK_PROD" && MAINTENANCE && !REBOOT_AI_OCR_SERVERS) {
        if ((new Date() - serverRestartedAt) > 60000) { // wait for 1  at least for server mapping minute
          console.log("start rebooting")
          REBOOT_AI_OCR_SERVERS = true
          enableBashRebootAllServers()
        }
      }
      if (process.env.REBOOT_ALL_SERVERS === "ENABLED") {
        console.log("...............checking for server rebooot........", REBOOT_CHECK)
        if (!REBOOT_CHECK) {
          REBOOT_CHECK = true
          checkRebootDone(() => {
            REBOOT_CHECK = false
          })
        }
      }
      if (!MAINTENANCE && process.env.FILE_OCR === "ENABLED" && process.env.KEY_VALUE_EXTRACT_OCR === 'DISABLED') {
        if (!IS_BATCH_OCR_QUEUE_EMPTY) {
          IS_BATCH_OCR_QUEUE_EMPTY = true; // h
          startOcrProcess((err) => {
            if (err) {
              console.log("iteration completes", err)
            }
            IS_BATCH_OCR_QUEUE_EMPTY = false;
          })
        } else {
          console.log("BATCH already in ocr progress");
        }
      }
      if (!MAINTENANCE && process.env.FILE_OCR === "ENABLED") {
        if (!IS_BATCH_FEEDBACK_QUEUE_EMPTY) {
          IS_BATCH_FEEDBACK_QUEUE_EMPTY = true; // h
          // console.log("STart batch extract")
          DATA_HELPERS._batchExtractViaAI(((err) => {
            if (err) {
              console.log("ERROR 85", err);
            } else {
              // console.log("done all step", res)
              IS_BATCH_FEEDBACK_QUEUE_EMPTY = false;
            }
            // console.log("END batch extract")
          }));
        } else {
          console.log("BATCH already in DT progress");
        }
      }
      if (process.env.FILE_PURGING === "ENABLED" && (minutes === 0 || minutes === 30)) {
        if (!IS_PURGING_QUEUE_EMPTY) {
          IS_PURGING_QUEUE_EMPTY = true
          // start purging downloaded files
          startPurgingFiles(() => {
            IS_PURGING_QUEUE_EMPTY = false
          })
        } else {
          console.log("file purging in progress")
        }
      }
      if (!MAINTENANCE && process.env.FILE_OCR === "ENABLED") {
        if (process.env.KEY_VALUE_EXTRACT_URL) {
          if (!IS_KEY_VALUE_EXTRACT_QUEUE_EMPTY) {
            IS_KEY_VALUE_EXTRACT_QUEUE_EMPTY = true
            // start start Key Value Extract for classified docuemnts fron indexer
            startKeyValueExtract(() => {
              IS_KEY_VALUE_EXTRACT_QUEUE_EMPTY = false
            })
          } else {
            console.log("startKeyValueExtract in progress")
          }
        } else {
          console.log("KEY_VALUE_EXTRACT_URL not found")
        }
        if (process.env.KEY_VALUE_EXTRACT_URL && process.env.KEY_VALUE_EXTRACT_OCR === 'ENABLED') {
          if (!IS_KEY_VALUE_EXTRACT_ROTATED_QUEUE_EMPTY) {
            IS_KEY_VALUE_EXTRACT_ROTATED_QUEUE_EMPTY = true
            startRotatedFileOcrProcess(() => {
              IS_KEY_VALUE_EXTRACT_ROTATED_QUEUE_EMPTY = false
            })
          } else {
            console.log("startRotatedFileOcrProcess in progress")
          }
        }
        if (process.env.KEY_VALUE_EXTRACT_URL && process.env.KEY_VALUE_EXTRACT_OCR === 'DISABLED') {
          if (!IS_KEY_VALUE_EXTRACT_NORMAL_QUEUE_EMPTY) {
            IS_KEY_VALUE_EXTRACT_NORMAL_QUEUE_EMPTY = true
            startKvpFileProcess(() => {
              IS_KEY_VALUE_EXTRACT_NORMAL_QUEUE_EMPTY = false
            })
          } else {
            console.log("startKvpFileProcess in progress")
          }
        }
        if (process.env.ROTATE_IMG_URL) {
          if (!IS_IMAGE_ROTATOR_QUEUE_EMPTY) {
            IS_IMAGE_ROTATOR_QUEUE_EMPTY = true
            // start jpg rotator for failed ocrClassification files and Supporting doc
            imageRotater(() => {
              IS_IMAGE_ROTATOR_QUEUE_EMPTY = false
            })
          } else {
            console.log("image rotator in progress")
          }
        } else {
          console.log("ROTATE_IMG_URL not found")
        }

        if (process.env.SPLIT_PDF_GENERTOR_URL) {
          if (!IS_PDF_GENERATOR_QUEUE_EMPTY) {
            IS_PDF_GENERATOR_QUEUE_EMPTY = true
            // start pdf generator for classified docuemnts fron indexer
            startPdfGenerator(() => {
              IS_PDF_GENERATOR_QUEUE_EMPTY = false
            })
          } else {
            console.log("pdf generator in progress")
          }
        } else {
          console.log("SPLIT_PDF_GENERTOR_URL not found")
        }
      }
      if (process.env.GENERATE_DAILY_REPORTS === "ENABLED") {
        const curr_time = moment().tz(process.env.TIME_ZONE || "America/Chicago").format("HH:mm:ss");
        // console.log("hours minutes seconds", hours, minutes, seconds)
        if (hours === 20 && minutes === 0 && seconds === 0) {
          console.log("staring 8PM generateDailyReports")
          // console.log(curr_time)
          generateDailyReports({ name: "mark_buckley", time: "8PM" }, (err) => {
            if (err) {
              console.log("generateDailyReports 8PM err:", err)
            }
          })
        }
        if (hours === 0 && minutes === 7 && seconds === 0) {
          console.log("staring 12AM generateDailyReports")
          // console.log(curr_time)
          generateDailyReports({ name: "mark_buckley", time: "12AM" }, (err) => {
            if (err) {
              console.log("generateDailyReports err:", err)
            }
          })
        }
        if (curr_time === "00:01:00" || curr_time === "20:00:00" || curr_time === "12:00:00") { // generate stats at 12 PM, 6 PM and 12:01 AM
          // console.log("inside currtime")
          console.log("starting generateDailyStats")
          let subTime = ""
          let curr_date = moment().tz(process.env.TIME_ZONE || "America/Chicago").format("DD-MM-YYYY");
          if (curr_time === "00:01:00") {
            subTime = "12 AM"
            curr_date = moment().subtract(1, 'day').tz(process.env.TIME_ZONE || "America/Chicago").format("DD-MM-YYYY");
          } else if (curr_time === "20:00:00") {
            subTime = "8 PM"
          } else {
            subTime = "12 PM"
          }
          getDailyStats({ name: "mark_buckley" }, { date: curr_date, subTime }, (err) => {
            if (err) {
              console.log("generateDailyStats err:", err)
            }
          })
        }
      }
      if (process.env.FILE_LOCK_CHECK === "ENABLED") {
        if (!IS_FILE_LOCK_QUEUE_EMPTY) {
          IS_FILE_LOCK_QUEUE_EMPTY = true; // h
          releaseUnnecessaryFileLock(() => {
            // console.log("WORKING")
            IS_FILE_LOCK_QUEUE_EMPTY = false;
          })
        } else {
          console.log("FILE ALREADy in lock checking progress");
        }
      }
      if (process.env.CHECK_DISK_LIST) {
        const curr_time = moment().tz("Asia/Kolkata").format("mm:ss");
        if (curr_time === "00:00" || curr_time === "30:00") {
          executeDiskSpaceCheck()
        }
      }
      if (process.env.SET_ALERT === "ENABLED") {
        checkAlerts(hours, minutes, seconds)
      }
      if (lastMinute !== minutes) {
        lastMinute = minutes
        console.log("every minute", seconds)
        if (process.env.NODE_ENV_LABEL === "MARK_PROD") {
          autoScheduler({ hours, minutes, currentDay }, (e) => {
            if (e) {
              console.log("autoScheduler", e)
            }
          })
        }
        checkAiServersCpuUtilization((err) => {
          if (err) {
            console.log("checkAiServersCpuUtilization", err)
          }
        })
        createQueueLogs({ hours, minutes, currentDay }, (err) => {
          if (err) {
            console.log(err)
          }
        })
        checkLastTenFilesAvgTime((err) => {
          if (err) {
            console.log(err)
          }
        })
      }
      if (process.env.DATA_ARCHIVE === "ENABLED") {
        if (DATA_ARCHIVED_AT !== currentDay) {
          DATA_ARCHIVED_AT = currentDay
          startArchive()
        }
      }
      if (process.env.READ_REPORT_TICKETS === "ENABLED") {
        if (!IS_READ_REPORT_TICKET_EMPTY) {
          IS_READ_REPORT_TICKET_EMPTY = true; // h
          readReportTickets(() => {
            // console.log("WORKING")
            IS_READ_REPORT_TICKET_EMPTY = false;
          })
        } else {
          console.log("report GENERATION in progress progress");
        }
      }
    }, CRON_DELAY_TIME);
  }
};
// setTimeout(() => {
//   console.log("...................started .........")
//   enableBashRebootAllServers()
// }, 1000 * 60)

const CRON_HANDLERS = () => initAiProcess(process.env.CRON_JOB !== "DISABLED");
process.on("lockIp", (data) => {
  // console.log("lockIp EVENT listened", data)
  ipOcrLock = data.ipOcrLock
  // IS_BATCH_OCR_QUEUE_EMPTY = false;
  // console.log("NOW ipOcrLock is ", ipOcrLock)
})
module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  CRON_HANDLERS
};
