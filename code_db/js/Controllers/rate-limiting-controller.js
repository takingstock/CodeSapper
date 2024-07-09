const config = require('config');
const { waterfall } = require('async');
const { rateLimitingService } = require('../Services');

const API_CONFIG = config.get('API_SPECIFIC');

/**
 * check login access limit
 * @param {String} ip
 * @param {String} userId
 * @param {String} customerId
 * @returns
 */
const checkLimitEntry = (ip = null, userId = null, customerId = null, cb) => {
  const criteria = {};

  if (ip) {
    criteria.ip = ip;
  }

  if (userId) {
    criteria.userId = userId;
  }

  if (customerId) {
    criteria.customerId = customerId;
  }

  const projection = {
    __v: 0,
  };
  const option = {
    lean: true,
  };
  rateLimitingService.read(criteria, projection, option, (err, result) => {
    if (err) {
      return cb(err);
    }
    if (result && result.length) {
      if (result[0].count >= API_CONFIG.RATE_LIMIT_COUNT) {
        const limitTime = new Date(result[0].limitedTill).getTime();
        const currentTime = new Date().getTime();

        if (currentTime > limitTime) {
          return cb(null, 'ACCESS');
        }
        return cb(null, 'ACCESS_DENIED');
      }
      return cb(null, 'ACCESS');
    }
    return cb(null, 'ACCESS');
  });

  // const result = await rateLimitingService.read(criteria, projection, option);
  // if (result && result.length && result[0].count >= API_CONFIG.RATE_LIMIT_COUNT) {
  //   const limitTime = new Date(result[0].limitedTill).getTime();
  //   const currentTime = new Date().getTime();

  //   if (currentTime > limitTime) {
  //     return 'ACCESS';
  //   }
  //   return 'ACCESS_DENIED';
  // }
  // return 'ACCESS';
};

/**
 * update limit access limit
 * @param {String} ip
 * @param {String} userId
 * @param {String} customerId
 * @returns
 */
const updateLimitEntry = (ip = null, userId = null, customerId = null, reset, hcb) => {
  const criteria = {};

  if (ip) {
    criteria.ip = ip;
  }
  if (userId) {
    criteria.userId = userId;
  }
  if (customerId) {
    criteria.customerId = customerId;
  }

  const projection = {
    __v: 0,
  };

  waterfall([
    (cb) => {
      rateLimitingService.read(criteria, projection, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    },
    (result, cb) => {
      const limitEntry = (result && result.length && result[0]) || null;
      let dataToUpdate = {};
      const option = {
        lean: true,
        upsert: true,
      };
      if (limitEntry) {
        if (limitEntry.count >= API_CONFIG.RATE_LIMIT_COUNT - 1) {
          dataToUpdate.limitedTill = new Date().getTime() + API_CONFIG.RATE_LIMIT_TILL;
          dataToUpdate.$inc = {
            count: 1,
          };
        } else {
          dataToUpdate.$inc = {
            count: 1,
          };
        }
        if (reset) {
          console.log("reset")
          dataToUpdate = { count: 0 }
        }
      } else {
        dataToUpdate.$inc = {
          count: 1,
        };
      }
      console.log("dataToUpdatedataToUpdate:,", dataToUpdate)
      rateLimitingService.update(criteria, dataToUpdate, option, (err, response) => {
        if (err) {
          return cb(err);
        }
        return cb(null, response);
      });
    },
  ], (err, result) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, result);
  });
};

/**
 * list all available limts for users
 * @returns
 */
const listLimitedEntries = (callback) => {
  const criteria = {
    count: {
      $gte: API_CONFIG.RATE_LIMIT_COUNT,
    },
    limitedTill: {
      $gte: new Date().getTime(),
    },
  };
  const projection = {
    __v: 0,
  };
  const option = {
    lean: true,
  };
  rateLimitingService.getListWithPopulate(criteria, {
    field: 'userId customerId',
    selectArray: ['userFullName'],
  }, projection, option, (err, result) => {
    callback(err, result && result.length ? result : []);
  });
};

/**
 * delete limit access from db
 * @param {Object} payload
 */
const deleteEntry = async (payload) => {
  const criteria = {
    $or: [],
  };

  if (payload.ip) {
    criteria.$or.push({
      ip: payload.ip,
    });
  }

  if (payload.userId) {
    criteria.$or.push({
      userId: payload.userId,
    });
  }

  if (payload.customerId) {
    criteria.$or.push({
      customerId: payload.customerId,
    });
  }
  await rateLimitingService.remove(criteria);
};

module.exports = {
  checkLimitEntry,
  updateLimitEntry,
  listLimitedEntries,
  deleteEntry,
};
