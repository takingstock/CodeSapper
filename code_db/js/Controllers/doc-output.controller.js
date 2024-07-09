const path = require('path');
const config = require('config');

const CsvParser = require('json2csv').Parser;

const { Readable } = require('stream');
const fs = require('fs');

// const { LOG_APPLICATION_ACTIVITY_ERRORS } = require('../Utils/logger.util');

const _pathToDownloads = path.join(__dirname, '../../', '/uploads/downloads');

const SERVER_HOST = config.get('HOST');

/**
 * create csv for download
 * @param {String} userId
 * @param {Object} mapping
 * @returns
 */
const createCsv = async (userId, mapping) => {
  const mappedResponse = mapping.map((item) => item.mapping);
  const csvParser = new CsvParser();
  const csvData = csvParser.parse(mappedResponse);
  return csvData;
};

/**
 * create csv for documents
 * @param {Array} docs
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const createDocsCsv = async (docs, batchName) => new Promise(async (resolve, reject) => {
  try {
    const csvParser = new CsvParser();
    const csvData = csvParser.parse(docs);
    const readableStream = Readable.from(csvData);
    const fileName = `${batchName}.csv`;
    const fileOutput = fs.createWriteStream(`/${_pathToDownloads}/${fileName}`, { encoding: 'utf8' });
    const host = process.env.BACKEND_HOST || SERVER_HOST[process.env.NODE_ENV] || SERVER_HOST.development
    // eslint-disable-next-line no-async-promise-executor
    fileOutput.on('close', () => resolve(`${host}downloads/${fileName}`));
    fileOutput.on('error', (err) => reject(err));
    readableStream.pipe(fileOutput);
  } catch (err) {
    console.log('error>>>', err)
    // LOG_APPLICATION_ACTIVITY_ERRORS(
    //   null,
    //   err,
    //   'Error in creating CSV',
    //   false,
    // );
    return resolve('');
  }
});

/**
 * create json for documents
 * @param {Array} docs
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const createDocsJson = async (docs, batchName) => new Promise(async (resolve, reject) => {
  try {
    const fileName = `${batchName}.json`;
    const fileOutput = fs.createWriteStream(`/${_pathToDownloads}/${fileName}`);
    const readableStream = Readable.from(JSON.stringify(docs));
    const host = process.env.BACKEND_HOST || SERVER_HOST[process.env.NODE_ENV] || SERVER_HOST.development
    fileOutput.on('close', () => resolve(`${host}downloads/${fileName}`));
    fileOutput.on('error', (err) => reject(err));
    readableStream.pipe(fileOutput);
  } catch (err) {
    console.log('error>>', err)
    // LOG_APPLICATION_ACTIVITY_ERRORS(
    //   null,
    //   err,
    //   'Error in creating CSV',
    //   false,
    // );
    return resolve('');
  }
});

module.exports = {
  createCsv,
  createDocsCsv,
  createDocsJson,
};
