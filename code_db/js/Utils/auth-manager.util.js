const config = require('config');
const { BoomCustomError } = require('./universal-functions.util');

const IMC_TOKEN = config.get('IMC.TOKEN');
const ERROR_MSG = config.get('STATUS_MSG.ERROR');

const verifyTokenRequest = (request, token) => {
  const validRequestObject = {
    valid: true,
  };
  if (token !== IMC_TOKEN) {
    throw BoomCustomError(401, ERROR_MSG.UNAUTHORIZED);
  } else {
    return validRequestObject;
  }
};

module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  verifyTokenRequest,
};
