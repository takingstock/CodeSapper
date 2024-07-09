const config = require('config');
const { auto } = require('async');
const moment = require('moment');

const { userService } = require('../Services');
const {
  hashPassword,
  generateAlphaNumericString,
  createMongooseId,
  hashPasswordCb,
} = require('../Utils/universal-functions.util');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const { REQUEST_EXTENSION, REQUEST_STORAGE } = require("../Helpers/emailTemplates")

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const TRIAL_ACCOUNT = config.get('TRIAL_ACCOUNT');

/**
 * fetch loggedIn user profile
 * @param {Object} userInfo
 * @returns
 */
const userProfile = ({ id }, callback) => {
  const criteria = {
    _id: id,
    isDeleted: false,
  };
  const projection = {
    email: 1,
    name: 1,
    roleId: 1,
    tenantId: 1,
    createdAt: 1,
  };
  const option = {
    lean: true,
  };
  const populateArray = [{
    path: 'roleId',
    fields: '_id role',
  }];
  userService.findOne(criteria, projection, option, populateArray, (err, response) => {
    if (!response) {
      return callback(null, {
        data: null,
        err
      });
    }
    const {
      roleId, password, isDeleted, ...user
    } = response;
    return callback(null, {
      data: {
        ...user,
        role: roleId.role,
        roleId: roleId._id,
      },
    });
  });
};

/**
 * update loggedIn user profile
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const updateProfile = ({ id }, payload, callback) => {
  userService.update({ _id: id, isDeleted: false }, { $set: payload }, { new: true }, (err, res) => {
    if (err) {
      callback(err)
    }
    return callback(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: res
    });
  });
};

/**
 *  update loggedIn user password
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const changePassword = ({ id }, payload, callback) => {
  auto({
    hash: (cb) => {
      hashPasswordCb(payload.password, 10, (err, res) => cb(err, res));
    },
    update: ['hash', ({ hash }, cb) => {
      userService.update({ _id: id, isDeleted: false }, { $set: { password: hash } }, {}, cb);
    }]
  }, (err) => {
    if (err) {
      callback(err);
    } else {
      callback(null, {
        ...HTTP_SUCCESS_MESSAGES.CHANGE_PASSWORD
      });
    }
  });
};

/**
 * users list
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns
 */
const usersList = (
  { tenantId = null },
  { q = '', limit = 10, offset = 0 },
  hcb,
) => {
  let criteria = {
    isDeleted: false,
    tenantId: createMongooseId(tenantId),
  };
  if (q) {
    criteria = {
      name: { $regex: q, $options: 'i' },
    };
  }
  const lookups = [{
    collection: 'roles',
    localField: 'roleId',
    foreignField: '_id',
    outputKey: 'roleData',
  }];
  userService.findAllByAggregation(
    criteria,
    {
      name: 1, email: 1, roleId: 1, createdAt: 1, tenantId: 1,
    },
    lookups,
    { createdAt: -1 }, offset, limit,
    (err, response) => {
      if (err) {
        hcb(err);
      }
      const { dataList, count } = response[0];
      const totalCount = count[0] && count[0].count ? count[0].count : 0;
      const mappedResponse = dataList.map((item) => {
        const { roleData = [], ...user } = item;
        if (roleData.length) {
          const role = roleData[0];
          return {
            ...user,
            role: role.role,
          };
        }
        return user;
      });
      return hcb(null, {
        data: mappedResponse,
        totalCount,
      });
    },
  );
};

/**
 *  users detail
 * @param {Object} userInfo
 * @param {Object} params
 * @returns
 */
const usersDetail = (_, { id: recordId }, hcb) => userProfile({ id: recordId }, (err, response) => {
  if (err) {
    return hcb(err)
  }
  return hcb(null, {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    ...response,
  })
})

/**
 * users create
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const usersCreate = ({ id, tenantId }, payload, hcb) => {
  const password = generateAlphaNumericString();
  auto({
    hashPassword: (cb) => hashPassword(password).then((hash) => cb(null, hash)),
    createUser: ['hashPassword', (results, cb) => {
      const { hashPassword: hash } = results;
      const body = {
        isDeleted: false,
        tenantId,
        status: true,
        tmpPassword: password,
        password: hash,
        createdBy: id,
        ...payload,
      };
      userService.create(body, (err, response) => {
        if (err) {
          return cb(err);
        }
        return cb(null, response);
      });
    }],
    profile: ['createUser', (results, cb) => {
      const { _id } = results.createUser;
      userProfile({ id: _id }, (err, response) => {
        if (err) {
          return cb(err)
        }
        return cb(null, {
          ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          ...response,
        })
      })
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.profile);
  });
};

/**
 * users update
 * @param {Object} userInfo
 * @param {Object} params
 * @param {Object} payload
 * @returns
 */
const usersUpdate = ({ id, tenantId }, { id: recordId }, payload, hcb) => {
  auto({
    isEmailExist: (cb) => {
      userService.findOne(
        { _id: { $ne: recordId }, email: payload.email },
        {},
        (err, response) => {
          if (err) {
            return cb(err);
          }
          if (response) {
            return cb(null, true);
          }
          return cb(null, false);
        },
      );
    },
    updateUser: ['isEmailExist', (results, cb) => {
      const { isEmailExist: isExist } = results;
      if (isExist) {
        return cb(null, {
          ...{ message: `Email (${payload.email}) is not allowed` },
        });
      }
      const dataToSet = {
        ...payload,
      };
      dataToSet.updatedBy = id;
      userService.update(
        { _id: recordId, tenantId, isDeleted: false }, { $set: payload }, { new: true }, (err, response) => {
          if (err) {
            return cb(err);
          }
          return cb(null, {
            ...HTTP_SUCCESS_MESSAGES.UPDATED,
            ...response,
          });
        },
      );
    }]
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.updateUser);
  });
};

/**
 * users delete
 * @param {Object} userInfo
 * @param {Object} params
 * @returns
 */
const usersDelete = ({ id, tenantId }, { id: recordId }, hcb) => {
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
  };
  userService.update({ _id: recordId, tenantId }, { $set: dataToSet }, { new: true }, (err, response) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DELETE_USER,
      ...response,
    });
  });
};
/**
 * update trial extend date
 * @param {Object} id
 * @returns
 */
const trialExtend = ({ id: userId }, { expiryInDays }, hcb) => {
  const dataToUpdate = {
    trialEndDate: moment().add(expiryInDays, 'days').toDate(),
  };
  auto({
    extendTrial: (cb) => {
      userService.update(
        { _id: userId, isDeleted: false, isTrialAccount: true },
        { $set: dataToUpdate },
        null,
        cb
      );
    },
    profile: ['extendTrial', (_, cb) => {
      userProfile({ id: userId }, cb);
    }]
  }, (err, { profile }) => {
    if (err) {
      hcb(err);
    }
    hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      ...profile
    });
  })
};

const requestExtension = ({ quota = false, trial = false, email = null }, callback) => {
  let dataToSet = {}
  auto({
    user: (cb) => {
      userService.findOne({ email }, { firstName: 1, lastName: 1, trialRequest: 1, quotaRequest: 1 }, null, null, cb)
    },
    trialExtendAlert: ['user', ({ user }, cb) => {
      if (!trial || !user || user.trialRequest === 'PENDING') {
        return cb(null, false)
      }
      dataToSet = {
        ...dataToSet,
        trialRequest: 'PENDING'
      }
      ImcAPIEndPoints.sendEmail({
        emails: TRIAL_ACCOUNT.NEW_SIGNUP_ALERT_EMAILS,
        subject: `New Trial Extension Request for VisionERA`,
        body: `
        Hi <br>
        ${email} has requested a Trial extension for VisionERA..<br>
        `
      })
      // user
      ImcAPIEndPoints.sendEmail({
        emails: email,
        subject: `VisionERA : Trial Extension Request`,
        body: REQUEST_EXTENSION(user),
      })
      cb(null, true)
    }],
    quotaExtendAlert: ['user', ({ user }, cb) => {
      if (!quota || !user || user.quotaRequest === 'PENDING') {
        return cb(null, false)
      }
      dataToSet = {
        ...dataToSet,
        quotaRequest: 'PENDING'
      }
      ImcAPIEndPoints.sendEmail({
        emails: TRIAL_ACCOUNT.NEW_SIGNUP_ALERT_EMAILS,
        subject: `New Quota Extension Request for VisionERA`,
        body: `
        Hi <br>
        ${email} has requested a quota extension for VisionERA..<br>
        `,
      })
      // user
      ImcAPIEndPoints.sendEmail({
        emails: email,
        subject: `VisionERA : Quota Increase Request`,
        body: REQUEST_STORAGE(user),
      })
      cb(null, true)
    }],
    updateUser: ['trialExtendAlert', 'quotaExtendAlert', ({ user }, cb) => {
      if (!Object.keys(dataToSet).length) {
        return cb(null, true)
      }
      userService.update({ _id: user._id }, { $set: dataToSet }, null, cb);
    }]
  }, () => { callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT) })
}
module.exports = {
  userProfile,
  updateProfile,
  changePassword,
  usersList,
  usersDetail,
  usersUpdate,
  usersCreate,
  usersDelete,
  trialExtend,
  requestExtension
};
