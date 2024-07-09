// const Bunyan = require('bunyan');
// // import Boom from '@hapi/boom';
// // const { BoomCustomError } = require('./universal-functions.util');
//
// const fse = require('fs-extra');
// const path = require('path');
//
// const LOG_DIR = path.join(__dirname, '../../', 'logs/');
// fse.ensureDirSync(LOG_DIR);
//
// const logger = Bunyan.createLogger({
//   name: 'ipd-vision-era',
//   serializers: Bunyan.stdSerializers,
//   streams: [
//     {
//       level: 'debug',
//       stream: process.stdout, // log INFO and above to stdout
//     },
//     {
//       level: 'error',
//       path: `${LOG_DIR}app-error.log`, // log ERROR and above to a file
//     },
//   ],
// });
//
// const LOG_APPLICATION_ACTIVITY_ERRORS = (
//   request,
//   err,
//   customMessage,
//   isThrowError = true,
//   errorType = 'fatal',
// ) => {
//   // [TODO]
//   // let user = null;
//   // let headers = null;
//   if (request) {
//     // user = request?.auth?.credentials?.user;
//     // headers = request?.headers;
//     request.log([errorType, customMessage], err);
//   }
//   logger[errorType](err, customMessage);
//   // return BoomCustomError(400, { message: customMessage || err.message });
//   if (isThrowError && !process.env.NODE_ENV) {
//     console.log("ERROR", err);
//   }
// };
//
// module.exports = {
//   logger,
//   LOG_APPLICATION_ACTIVITY_ERRORS,
// };
