const { mapSeries } = require('async');

const { nanoid } = require('nanoid');

const path = require('path');

const config = require('config');

const fs = require('fs');

const archiver = require('archiver');
const Unrar = require('node-unrar');
const AdmZip = require('adm-zip');
const axios = require('axios');
const fsXtra = require('fs-extra');
const { createReadStream, createWriteStream, readdirSync } = require('fs');
const { s3FileUpload } = require("../Utils/S3")

const { getFileSizeInBytes } = require('../Utils/universal-functions.util');

const ERR_MESSAGES = config.get('ERR_MESSAGES');
const VALID_FILES_EXTENSIONS = config.get('VALID_FILES_EXTENSIONS');
const SERVER_HOST = config.get('HOST');
const _pathToDownloads = path.join(__dirname, '../../', '/uploads/downloads');

/**
 * get file path for db
 * @param {String} filePath
 * @returns
 */
const _filePathToSave = (filePath) => filePath.substring(filePath.indexOf('uploads')).replace('uploads/', '');

/**
 * get file extension
 * @param {String} fileName
 * @returns
 */
const _checkExtension = (fileName) => path.extname(fileName);

/**
 * get file extension
 * @param {String} fileName
 * @returns
 */
const _grabFileName = (fileName) => path.basename(fileName);

/**
 * validate uploaded files
 * @param {Array} files
 * @returns
 */
const _validateFileExtensions = async (files) => {
  const errors = [];
  files.forEach(async (item) => {
    if (VALID_FILES_EXTENSIONS.indexOf(item.fileExtension) === -1) {
      errors.push(`${item.fileOriginalName} has unsupported file type`);
    }
  });
  // if errors delete files
  if (errors.length) {
    await Promise.all(files.map((item) => fsXtra.remove(item.filePath)));
  }
  return errors;
};

/**
 * create directory wrt loggedin user & tenant/enterprise
 * @param {object} userInfo
 * @returns
 */
const createPathDir = ({ id, tenantId }) => {
  let pathDir = path.join(__dirname, '../../', 'uploads');
  if (tenantId) {
    pathDir = `${pathDir}/${tenantId}`;
  }
  if (id) {
    pathDir = `${pathDir}/${id}`;
  }
  return pathDir;
};

/**
 * write file to the directory using path
 * @param {String} filePath
 * @param {String} pathDir
 * @returns
 */
const _writeFileFromPath = async (filePath, pathDir) => {
  const fileExtension = _checkExtension(filePath);
  const fileSlugName = `${nanoid(15)}${fileExtension}`;
  const newFilePath = `${pathDir}/${fileSlugName}`;
  const fileStream = createReadStream(filePath);
  fileStream
    .pipe(createWriteStream(newFilePath));
  return {
    fileOriginalName: _grabFileName(filePath),
    fileName: fileSlugName,
    filePathToSave: _filePathToSave(newFilePath),
    filePath: newFilePath,
    fileExtension,
    fileSize: getFileSizeInBytes(filePath),
  };
};

/**
 * upload file
 * @param {Object} file
 * @param {String} pathDir
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const _uploadFile = (file, pathDir) => new Promise(async (resolve, reject) => {
  const fileOriginalName = file.hapi.filename;
  const fileExtension = _checkExtension(fileOriginalName);
  const fileSlugName = `${nanoid(15)}${fileExtension}`;
  const filePath = `${pathDir}/${fileSlugName}`;
  const pathToSave = _filePathToSave(filePath);
  try {
    if (process.env.S3_ENABLED) {
      const imageDetails = await s3FileUpload(file, fileSlugName);
      const returnObj = {
        fileOriginalName,
        fileName: fileSlugName,
        filePathToSave: pathToSave,
        s3Url: imageDetails.Location,
        filePath,
        fileExtension,
        fileSize: imageDetails.ContentLength,
      };
      resolve(returnObj);
    } else {
      const fileStream = createWriteStream(filePath);
      await fsXtra.ensureDir(pathDir);
      file.on('error', (err) => reject(err));
      file.pipe(fileStream);
      file.on('end', (err) => {
        if (err) {
          return reject(err);
        }
        const fileSize = getFileSizeInBytes(filePath);
        const returnObj = {
          fileOriginalName,
          fileName: fileSlugName,
          filePathToSave: pathToSave,
          filePath,
          fileExtension,
          fileSize,
        };
        return resolve(returnObj);
      });
    }
  } catch (err) {
    console.log("got an error while writing file", err)
  }
});

/**
 * handle zip files
 * @param {Object} file
 * @param {String} pathDir
 * @returns
 */
const _handleZip = ({
  fileOriginalName, fileName, filePath,
  // eslint-disable-next-line no-async-promise-executor
}, pathDir) => new Promise(async (resolve, reject) => {
  try {
    const zip = new AdmZip(filePath);
    const fileNameWithoutExt = fileName.split('.')[0];
    const extractedPath = `${path.dirname(filePath)}/${fileNameWithoutExt}`;
    zip.extractAllTo(/* target path */extractedPath, /* overwrite */true);
    const zipEntries = zip.getEntries().filter((item) => !((item.name).startsWith('._')));
    const filesToValidate = zipEntries.map(e => ({ fileExtension: _checkExtension(e.entryName), filePath: `${extractedPath}/${e.entryName}` }));
    const errors = await _validateFileExtensions(filesToValidate);
    if (errors.length) {
      return reject(ERR_MESSAGES.UPLOAD_FILES_INVALID);
    }
    const files = await Promise.all(
      zipEntries.map((zipEntry) => _writeFileFromPath(`${extractedPath}/${zipEntry.entryName}`, pathDir)),
    );
    // await fsXtra.remove(filePath);
    await fsXtra.remove(extractedPath);
    // return resolve(files);
    return resolve({
      type: 'zip',
      folderName: fileName,
      folderOriginalName: fileOriginalName,
      filePath,
      files,
    });
  } catch (err) {
    return reject(err);
  }
});

/**
 * handle rar files
 * @param {Object} file
 * @param {String} pathDir
 * @returns
 */
const _handleRar = async ({ fileName, filePath, fileOriginalName }, pathDir) => new Promise(
  // eslint-disable-next-line no-async-promise-executor
  async (resolve, reject) => {
    try {
      const fileNameWithoutExt = fileName.split('.')[0];
      const extractedPath = `${path.dirname(filePath)}/${fileNameWithoutExt}`;
      await fsXtra.ensureDir(extractedPath);
      const rar = new Unrar(filePath);
      return rar.extract(extractedPath, null, async (err) => {
        if (err) {
          return reject(err);
        }
        // file extracted successfully.
        const files = readdirSync(extractedPath);
        const filesToValidate = files.map(e => ({ fileExtension: _checkExtension(e), filePath: `${extractedPath}/${e}` }));
        const errors = await _validateFileExtensions(filesToValidate);
        if (errors.length) {
          return reject(ERR_MESSAGES.UPLOAD_FILES_INVALID);
        }
        const mappedFiles = await Promise.all(
          files.map((file) => _writeFileFromPath(`${extractedPath}/${file}`, pathDir)),
        );
        // await fsXtra.remove(filePath);
        await fsXtra.remove(extractedPath);
        // return resolve(mappedFiles);
        return resolve({
          type: 'rar',
          folderName: fileName,
          folderOriginalName: fileOriginalName,
          filePath,
          files: mappedFiles,
        });
      });
    } catch (err) {
      return reject(err);
    }
  },
);

/**
 * upload files
 * @param {Array} files
 * @param {String} pathDir
 * @returns
 */
const upload = async (files, pathDir) => {
  try {
    const processesFiles = await new Promise((resolve, reject) => {
      mapSeries(files, (file, cb) => {
        const ext = _checkExtension(file.hapi.filename);
        _uploadFile(file, pathDir)
          .then(async (uploadedFileAttributes) => {
            if (ext === '.zip') {
              const data = await _handleZip(uploadedFileAttributes, pathDir);
              return cb(null, { ...data, fileSize: uploadedFileAttributes.fileSize });
            } if (ext === '.rar') {
              const data = await _handleRar(uploadedFileAttributes, pathDir);
              return cb(null, { ...data, fileSize: uploadedFileAttributes.fileSize });
            }
            return cb(null, {
              type: 'single',
              files: [uploadedFileAttributes],
              fileSize: uploadedFileAttributes.fileSize
            });
          })
          .catch((err) => cb(err));
      }, async (err, filesArray) => {
        if (err) {
          return reject(err);
        }
        const mappedFilesArray = filesArray.flat();
        const filesToValidate = mappedFilesArray.map((item) => item.files).flat();
        const errors = await _validateFileExtensions(filesToValidate);
        if (errors.length) {
          return reject(ERR_MESSAGES.UPLOAD_FILES_INVALID);
        }
        // return mappedFilesArray;
        return resolve(mappedFilesArray);
      });
    });
    return processesFiles;
  } catch (err) {
    return { message: err.message || err };
  }
};

/**
 * fetch document response from OCR server
 * @param {String} url
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const _fetchWithAxios = (url) => new Promise(async (resolve, reject) => {
  const response = await axios({
    method: 'get',
    url,
    responseType: 'stream',
  });
  const stream = response.data;
  stream
    .on('error', (err) => reject(err))
    .on('end', () => { });
  return resolve(stream);
});

/**
 * create zip file from remote urls
 * @param {Array} urls
 * @returns
 */
// eslint-disable-next-line no-async-promise-executor
const _createZipFile = async (urls) => new Promise(async (resolve, reject) => {
  const zipArchive = archiver.create('zip');
  const pathToSave = path.join(__dirname, '../../', '/uploads/downloads');
  const fileName = `${nanoid(15)}.zip`;
  await fsXtra.ensureDir(pathToSave);
  const fileOutput = fs.createWriteStream(`/${pathToSave}/${fileName}`);
  const host = process.env.BACKEND_HOST || SERVER_HOST[process.env.NODE_ENV] || SERVER_HOST.development
  fileOutput.on('close', () => resolve(`${host}downloads/${fileName}`));
  fileOutput.on('error', (err) => reject(err));
  zipArchive.pipe(fileOutput);
  await Promise.all(urls.map(async (url) => {
    const stream = await _fetchWithAxios(url);
    zipArchive.append(stream, { name: url.replace(/^.*\//, '') });
  }));
  zipArchive.finalize();
});

/**
 * write file to the server for download & provide link for download
 * @param {Array} urls
 * @returns
 */
const createDownloadLink = async (urls) => {
  if (!urls.length) {
    return null;
  }
  if (urls.length > 1) {
    return _createZipFile(urls);
  }
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const [url] = urls;
    const stream = await _fetchWithAxios(url);
    const file = url.replace(/^.*\//, '');
    await fsXtra.ensureDir(_pathToDownloads);
    const fileOutput = fs.createWriteStream(`/${_pathToDownloads}/${file}`);
    const host = process.env.BACKEND_HOST || SERVER_HOST[process.env.NODE_ENV] || SERVER_HOST.development
    fileOutput.on('close', () => resolve(`${host}downloads/${file}`));
    fileOutput.on('error', (err) => reject(err));
    stream.pipe(fileOutput);
  });
};

module.exports = {
  createPathDir,
  upload,
  createDownloadLink,
};
