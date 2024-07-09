/* eslint-disable class-methods-use-this */
const Boom = require('@hapi/boom');
// const moment = require('moment');
const moment = require("moment-timezone");
const mongoose = require('mongoose');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const fs = require('fs');
const capitalize = require('capitalize');
const { auto } = require("async");
const { exec } = require("child_process");
const { readFileSync } = require('fs');
const { Client } = require('ssh2');
const config = require("config")

const PEM_PATH = config.get("IMP_FILES.PEM_PATH")
const { teamsService, customersService } = require('../Services');

const API_LIMIT_REMAINING = '5000/5000';
const APP_CONSTANTS = {}
const hashPassword = async (plainText, saltRounds = 10) => {
  const salt = await bcrypt.genSalt(saltRounds);
  const hash = await bcrypt.hash(plainText, salt);
  return hash;
};

const hashPasswordCb = (plainText, saltRounds = 10, cb) => {
  bcrypt.hash(plainText, +saltRounds, (err, hash) => cb(err, hash));
};

const generateAlphaNumericString = () => Math.random().toString(36).slice(5);

const createMongooseId = (objectIdString) => mongoose.Types.ObjectId(objectIdString);

const createNewMongooseId = () => new mongoose.Types.ObjectId();

const authorizationHeaderObj = () => Joi.object({
  authorization: Joi.string().required(),
}).unknown();

const calculateProcessedPercentage = (
  passed = 0, failed = 0, totalFiles,
) => parseInt(((passed + failed) * 100) / totalFiles, 10);

const getFileTypeViaExt = (fileName) => fileName.split('.').pop().toUpperCase();

const getFileSizeInBytes = (filename) => {
  try {
    const stats = fs.statSync(filename);
    return stats.size;
  } catch (err) {
    console.log("ERROR getFileSizeInBytes", err)
    return 0
  }
};

const base64Encode = (file) => {
  const body = fs.readFileSync(file);
  return body.toString('base64');
};

const generateDateRange = (monthIndex, year) => {
  const startDate = moment().set({
    year,
    month: monthIndex,
    date: 1,
  });
  const stopDate = moment().set({
    year,
    month: monthIndex,
    date: 31,
  });

  const dates = [];
  const currentDate = startDate;

  /* eslint-disable no-unmodified-loop-condition */
  while (currentDate <= stopDate) {
    const dateToPush = currentDate.format('DD-MM-YYYY');
    const monthBeingPushed = parseInt(dateToPush.split('-')[1], 10);
    if ((monthBeingPushed - 1) === monthIndex) {
      dates.push(dateToPush);
    } else {
      // eslint-disable-next-line no-console
      console.log('not pushed', (monthBeingPushed - 1), monthIndex);
    }
    currentDate.add(1, 'day');
  }
  return dates;
};

const getStartAndEndTimeForDate = (dateTime = new Date()) => {
  const timeObj = {
    start: null,
    end: null,
  };
  timeObj.start = new Date(dateTime);
  timeObj.start.setHours(0, 0, 0, 0);
  timeObj.start = new Date(timeObj.start).getTime()
    - (5.5 * 60 * 60 * 1000); // subtract 5.5 hours to gmt
  timeObj.start = new Date(timeObj.start).toISOString();

  timeObj.end = new Date(dateTime);
  timeObj.end.setHours(23, 59, 59, 999);
  timeObj.end = new Date(timeObj.end).getTime()
    - (5.5 * 60 * 60 * 1000); // subtract 5.5 hours to gmt
  timeObj.end = new Date(timeObj.end).toISOString();

  return timeObj;
};

const getIndianDateFormatFromISO = (inputString) => {
  let outputString = '';
  if (inputString && inputString.length) {
    outputString = inputString.substr(0, inputString.indexOf('T'));
    outputString = outputString.split('-').reverse().join('-');
    return outputString;
  }
  return null;
};

const parseQrJwt = (token) => {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));

  return JSON.parse(jsonPayload);
};

const normalisedCoordinates = (pts = [], {
  height = 0,
  width = 0,
}) => {
  if (Array.isArray(pts) && pts.length === 4 && height && width) {
    const [a, b, c, d] = pts;
    return [a / width, b / height, c / width, d / height];
  }
  return [];
};

const BoomCustomError = ({ statusCode = 500, message, type = 'error', isBoom = false, ...error }) => {
  if (isBoom) {
    statusCode = error.output.statusCode || statusCode
  }
  let boomError = null;
  switch (statusCode) {
    case 400:
      boomError = Boom.badRequest(message);
      break;
    case 401:
      boomError = Boom.unauthorized(message);
      break;
    case 403:
      boomError = Boom.forbidden(message);
      break;
    case 404:
      boomError = Boom.notFound(message);
      break;
    case 429:
      boomError = Boom.tooManyRequests(message);
      break;
    case 503:
      boomError = Boom.serverUnavailable(message);
      break;
    case 422:
      boomError = Boom.badData(message);
      break;
    default:
      boomError = Boom.badImplementation(message);
  }
  boomError.reformat();
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    boomError.output.payload.type = type;
    boomError.output.payload.description = message || 'error';
  }
  if (type !== 'error') {
    boomError.output.payload.type = type;
  }
  return boomError;
};

const slugify = (text) => text
  .toString()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^\w-]+/g, '')
  .replace(/--+/g, '_');

const capitalise = (text) => capitalize.words(text);

const executeRemoteSSHQuery = (query, remote_ip) => {
  // return;
  //query = 'sudo ls';
  console.log("PEM_PATH", PEM_PATH)
  console.log("query, remote_ip", query, remote_ip)
  auto({
    'clearKnownHost': (cb) => {
      //return cb();
      const command = `ssh-keygen -f "/home/ubuntu/.ssh/known_hosts" -R "${remote_ip}"`
      exec(command, { timeout: 2000 }, (err, stdout, stderr) => {
        console.log('stderr', stderr)
        console.log('stdout', stdout)
        cb()
      })
    },
    'rebootServer': ['clearKnownHost', () => {
      console.log('inside rebootServer')
      try {
        const conn = new Client();
        conn.on('ready', () => {
          console.log('Client :: ready', 'query', query, 'remote_ip', remote_ip);
          conn.exec(query, (err, stream) => {
            if (err) {
              console.error('Error in SSH', err);
              conn.end();
            }
            stream.on('close', (code, signal) => {
              console.log(`Stream :: close :: code: ${code}   signal: ${signal}`);
              conn.end();
            }).on('data', (data) => {
              console.log(`STDOUT: ${data}`);
              conn.end();
            }).stderr.on('data', (data) => {
              console.log(`STDERR: ${data}`);
              conn.end();
            });
          });
        }).on('error', (err) => {
          console.log('ssh connection error', err)
        }).connect({
          host: remote_ip,
          port: 22,
          username: 'ubuntu',
          tryKeyboard: true,
          privateKey: readFileSync(PEM_PATH)
        });
      } catch (e) {
        console.log('Error in rebooting...', e)
      }
    }]
  })
}
// setTimeout(() => {
//   executeRemoteSSHQuery(`bash /home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/maintenance.sh`, '10.0.120.8')
// }, 1000 * 60)
// executeRemoteSSHQuery(`sudo ls`, '10.0.121.23')
const format = 'YYYY-MM-DD HH:mm:ss';
const toTimeZone = (time) => {
  if (time) {
    return moment(time, format).tz("Asia/Kolkata").format(format);
  }
  return moment(new Date(), format).tz("Asia/Kolkata").format(format);
}

const isValidUrl = urlString => {
  if (!urlString) {
    return false
  }
  if (urlString.startsWith('https') || urlString.startsWith('http') || urlString.startsWith('www')) {
    const urlPattern = new RegExp(`^(https?:\\/\\/)?((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$`, 'i');
    return !!urlPattern.test(urlString);
  }
  return false
}

const getTimeDifferenceInSec = (startTime, endTime) => {
  const timeDiff = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000;
  console.log("timeDiff::", timeDiff)
  return timeDiff
}

const getDateRangeBetweenTwoDates = (startDate, endDate) => {
  let start = moment(startDate, "DD-MM-YYYY")
  const end = moment(endDate, "DD-MM-YYYY")
  console.log("start, end", start, end)

  const dates = [];
  // while (start <= end) {
  while (start.isSameOrBefore(end)) {
    const date = moment(start).format("DD-MM-YYYY")
    dates.push(date);
    start = moment(start).add(1, 'days')
  }
  return dates;
}
const fetchCustomersFromUserId = (id) => new Promise((resolve) => {
  let criteria = {
    $or: [{
      indexerArray: {
        $in: [createMongooseId(id)]
      }
    }, {
      superVisorId: id
    }
    ]
  }
  let projection = {
    teamName: 1
  }
  let customers = []
  let teams = []
  teamsService.findAll(criteria, projection, {}, (err, response) => {
    if (err) {
      console.log("fetch teams error", err)
      return resolve([])
    }
    for (const each of response) {
      if (teams.indexOf(each.teamName) === -1) {
        teams = [...teams, each.teamName]
      }
    }
    criteria = {
      teamName: {
        $in: teams
      }
    }
    projection = {
      customersArray: 1
    }
    customersService.findAll(criteria, projection, {}, (err, res) => {
      if (err) {
        console.log("fetch customers error", err)
        return resolve([])
      }
      for (const each of res) {
        customers = [...customers, ...each.customersArray]
      }
      return resolve(customers)
    })
  })
})

module.exports = {
  hashPasswordCb,
  hashPassword,
  generateAlphaNumericString,
  createMongooseId,
  base64Encode,
  generateDateRange,
  getStartAndEndTimeForDate,
  getIndianDateFormatFromISO,
  getFileTypeViaExt,
  authorizationHeaderObj,
  getFileSizeInBytes,
  BoomCustomError,
  createNewMongooseId,
  parseQrJwt,
  calculateProcessedPercentage,
  normalisedCoordinates,
  slugify,
  capitalise,
  API_LIMIT_REMAINING,
  executeRemoteSSHQuery,
  toTimeZone,
  isValidUrl,
  fetchCustomersFromUserId,
  getTimeDifferenceInSec,
  getDateRangeBetweenTwoDates
};
