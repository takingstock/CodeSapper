const config = require('config');
const { BoomCustomError } = require('./universal-functions.util');

const { verifyTokenRequest } = require('./auth-manager.util');

const { verifyToken, verifyApiKeyToken } = require('./token-manager.util');

const ERROR_MSG = config.get('STATUS_MSG.ERROR');

const authSimpleStrategy = (request, token) => new Promise((resolve) => {
  console.log("authSimpleStrategy", token)
  try {
    const response = verifyTokenRequest(request, token);
    console.log("authSimpleStrategy", response)

    const isValid = (response && response.valid) || false;
    if (isValid) {
      return resolve({
        isValid,
        credentials: {
          token,
        },
      });
    }
    throw BoomCustomError(ERROR_MSG.UNAUTHORIZED);
  } catch (err) {
    throw BoomCustomError(ERROR_MSG.UNAUTHORIZED);
  }
});

const authApiStrategy = async (request, token) => {
  try {
    const response = await verifyToken(token);
    const isValid = (response && response.valid) || false;
    if (isValid) {
      return {
        isValid,
        credentials: {
          scope: response.user.role,
          token,
          user: response.user,
        },
      };
    }
    throw BoomCustomError(ERROR_MSG.INVALID_TOKEN);
  } catch (err) {
    throw BoomCustomError(ERROR_MSG.INVALID_TOKEN);
  }
};
// /////////////////////////////////////////////////////// API KEY AUTH       ///////////////////////////////////////
const authApiKeyStrategy = async (request, token) => {
  try {
    const response = await verifyApiKeyToken(token);
    const isValid = (response && response.valid) || false;
    if (isValid) {
      // if (response.user && response.user.whiteListIp.length) {
      //   const ipList = response.user.whiteListIp;
      //   const currentIp = request.headers['x-real-ip'] || request.info.remoteAddress;
      //   console.log("currentIpcurrentIp", currentIp);
      //   if (!ipList.includes(currentIp)) {
      //     throw BoomCustomError(ERROR_MSG.INVALID_IP);
      //   }
      // }
      return {
        isValid,
        credentials: {
          user: response.user,
          scope: response.user.role,
        },
      };
    }
    throw BoomCustomError(ERROR_MSG.INVALID_TOKEN);
  } catch (err) {
    throw BoomCustomError((err && err.output && err.output.payload) || ERROR_MSG.INVALID_TOKEN);
  }
}
module.exports = {
  authSimpleStrategy,
  authApiStrategy,
  authApiKeyStrategy
};
