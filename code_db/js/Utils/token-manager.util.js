/* eslint-disable no-param-reassign */

const config = require('config');
const Jwt = require('jsonwebtoken');

const {
  redisClient,
  encryptStringWithRsaPublicKey,
  decryptStringWithRsaPrivateKey,
} = require('../Configurations/redis.config');

const { BoomCustomError } = require('./universal-functions.util');

const serverConfig = config.get('SERVER');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const { verifyIdpKey } = require('../Controllers/idp-key.controller');
// Middleware for token verification
const getTokenFromRedis = (key) => new Promise((resolve, reject) => {
  key = `${serverConfig.REDIS_KEY_PREFIX}${key}`;
  redisClient.get(key, (err, data) => {
    if (err) {
      reject(err);
    } else {
      resolve(data);
    }
  });
});

const setTokenInRedis = (key, value) => new Promise((resolve, reject) => {
  key = key.toString();
  key = `${serverConfig.REDIS_KEY_PREFIX}${key}`;
  redisClient.set(key, value, (err, data) => {
    if (err) {
      reject(err);
    } else {
      resolve(data);
    }
  });
});

const expireTokenInRedis = (key) => new Promise((resolve) => {
  if (key != null) {
    key = `${serverConfig.REDIS_KEY_PREFIX}${key}`;
    redisClient.expire(key, 0, (err, data) => {
      resolve(err, data);
    });
  }
});

const verifyToken = async (token) => {
  const response = {
    valid: false,
  };
  const decryptedData = decryptStringWithRsaPrivateKey(token);
  const data = await getTokenFromRedis(decryptedData.id); // use single device login mechanism
  if (data && data === token) {
    if (
      decryptedData
      && decryptedData.notBefore < new Date().getTime()
      && decryptedData.notAfter > new Date().getTime()
    ) {
      response.valid = true;
      response.user = decryptedData;
      return response;
    }
    throw BoomCustomError(HTTP_ERROR_MESSAGES.TOKEN_ALREADY_EXPIRED);
  }
  throw BoomCustomError(HTTP_ERROR_MESSAGES.INVALID_TOKEN);
};

const setToken = (tokenData, cb) => {
  const token = tokenData;
  if (!tokenData.id) {
    cb(HTTP_ERROR_MESSAGES.INVALID_TOKEN);
  } else {
    token.notBefore = new Date().getTime();
    token.notAfter = new Date().getTime() + (24 * 60 * 60 * 1000 * 30);
    const tokenToSend = encryptStringWithRsaPublicKey(JSON.stringify(token));
    // console.log("tokentoken", token)
    setTokenInRedis(token.id, tokenToSend).then(() => cb(null, {
      accessToken: tokenToSend
    }));
  }
};

// expire token in redis
const expireToken = async (token, cb) => {
  try {
    const decryptedData = decryptStringWithRsaPrivateKey(token);
    if (decryptedData
      && decryptedData.notBefore < new Date().getTime()
      && decryptedData.notAfter > new Date().getTime()) {
      return expireTokenInRedis(decryptedData.id)
        .then((err, data) => {
          if (err) {
            return cb(err);
          }
          return cb(null, data);
        });
    }
    return cb(HTTP_ERROR_MESSAGES.TOKEN_ALREADY_EXPIRED);
  } catch (e) {
    return cb(HTTP_ERROR_MESSAGES.INVALID_TOKEN);
  }
};

const decodeToken = (token) => new Promise((resolve) => {
  Jwt.verify(token, serverConfig.JWT_SECRET_KEY, (err, decodedData) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        throw BoomCustomError(HTTP_ERROR_MESSAGES.TOKEN_ALREADY_EXPIRED);
      }
      throw BoomCustomError(HTTP_ERROR_MESSAGES.INVALID_TOKEN);
    }
    return resolve(decodedData);
  });
});

// //api KEY ???????????????????????????
const verifyApiKeyToken = async (key) => {
  const response = {
    valid: false,
  };
  const data = await verifyIdpKey(key);

  if (data) {
    response.valid = true;
    response.user = data.user || {};
    return response;
  }
  throw BoomCustomError(HTTP_ERROR_MESSAGES.TOKEN_ALREADY_EXPIRED);
};

module.exports = {
  expireToken,
  setToken,
  verifyToken,
  decodeToken,
  getTokenFromRedis,
  setTokenInRedis,
  verifyApiKeyToken
};
