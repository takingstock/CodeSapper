/* eslint-disable no-console */
const Boom = require('@hapi/boom');
const config = require('config');

const envConfig = config.get('ENV');
const CONSOLE = require('./console-log.util');

const validationErrorHandler = async (request, h, err) => {
  // console.log("process.env.NODE_ENV", process.env.NODE_ENV, envConfig)
  if (process.env.NODE_ENV === envConfig.PROD) {
    CONSOLE.error('ValidationError:', err.message);
    if (request.auth && request.auth.credentials && request.auth.credentials.user && request.auth.credentials.user.email === 'farha@amygb.ai') {
      throw err;
    }
    // In prod, log a limited error message and throw the default Bad Request error.
    throw Boom.badRequest('Invalid request payload input');
  } else {
    // During development, log and respond with the full error.
    throw err;
  }
};

module.exports = {
  validationErrorHandler,
};
