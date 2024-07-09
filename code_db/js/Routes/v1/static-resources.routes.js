const Boom = require('@hapi/boom');
const Joi = require('joi');
const fs = require('fs')
const path = require('path');
const { readfileFromStream } = require('../../Utils/S3')
// [Handler]- sever requested downloaded files
// reference https://stackoverflow.com/questions/42297328/download-a-file-from-nodejs-server-using-hapi
const downloadDocument = async (request, h) => {
  const splitArr = request.params.fileName.split('.');
  const extension = splitArr.length ? splitArr.pop().toLowerCase() : null;
  let contentType = '';
  switch (extension) {
    case 'zip':
      contentType = 'application/zip';
      break;
    case 'png':
      contentType = 'image/png';
      break;
    case 'jpeg':
      contentType = 'image/jpeg';
      break;
    case 'jpg':
      contentType = 'image/jpg';
      break;
    case 'pdf':
      contentType = 'application/pdf';
      break;
    case 'rar':
      contentType = 'application/vnd.rar';
      break;
    case 'csv':
      contentType = 'text/csv';
      break;
    case 'json':
      contentType = 'application/json';
      break;
    case 'xls':
      contentType = 'application/vnd.ms-excel';
      break;
    case 'xlsx':
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
    default:
  }
  try {
    const filePath = path.join(__dirname, '../../../', '/uploads', 'downloads', request.params.fileName)
    if (fs.existsSync(filePath)) {
      return h.file(`downloads/${request.params.fileName}`)
        .type(contentType)
        .header('content-disposition', 'attachment');
    }
    const fileStream = readfileFromStream(request.params.fileName, true)
    return h.response(fileStream)
      .type(contentType)
      .encoding('binary')
      .header('Content-Type', contentType)
      .header('Content-Disposition', `attachment; filename=${request.params.fileName}`);
  } catch (err) {
    console.log("I AM OUT OF ORDER", err);
    request.log(['error', 'zip-download'], err);
    throw Boom.boomify(err);
  }
};

const routes = [
  {
    method: 'GET',
    path: '/downloads/{fileName}',
    handler: downloadDocument,
    options: {
      validate: {
        params: {
          fileName: Joi.string().required(),
        },
      },
    },
  },
];
module.exports = routes;
