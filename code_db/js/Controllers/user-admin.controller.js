const config = require('config');
const { auto, parallel } = require('async');
const moment = require('moment');
const {
  hashPasswordCb,
  generateAlphaNumericString,
  createMongooseId
} = require('../Utils/universal-functions.util');

const TENANT_SETTINGS = require('../Models/tenant-setting.model')
const { userService, roleService, tenantService, workflowService } = require('../Services');
const globalMappingController = require('./global-mapping.controller');
const { APPROVE_CUSTOMER_TEMPLATE, APPROVE_STORAGE, APPROVE_EXTENSION } = require('../Helpers/emailTemplates');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');

const ROLES_LIST = config.get('ROLES.LIST');
const ROLES_ENTERPRISE_ADMIN = ROLES_LIST.find((role) => role === 'ENTERPRISE_ADMIN');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const TRIAL_ACCOUNT = config.get('TRIAL_ACCOUNT');

/**
 * check uniqueEmail
 * @param {String} email
 */
const checkUniqueEmail = async (email) => {
  const result = await userService.findOne({ email }, { email: 1 });
  if (result) {
    throw new Error('Email already exist');
  }
};

/**
 * check tenant
 * @param {String} tenantName
 */
const checkUniqueTenant = async (tenantName) => {
  const result = await tenantService.findOne({ name: tenantName }, { name: 1 });
  if (result) {
    throw new Error('Tenant already exist');
  }
};

/**
 * fetch loggedIn user profile
 * @param {Object} params
 * @returns
 */
const _userProfile = ({ id }, hcb) => {
  const criteria = {
    _id: id,
    isDeleted: false,
  };
  const projection = {
    name: 1, email: 1, roleId: 1, createdAt: 1, tmpPassword: 1, tenantId: 1,
  };
  const option = {
    lean: true,
  };
  const populateArray = [{
    path: 'roleId',
    fields: '_id role',
  }];
  userService.findOne(criteria, projection, option, populateArray, (err, results) => {
    if (err) {
      return hcb(err);
    }
    if (results) {
      const {
        roleId
      } = results;
      return hcb(null, {
        data: {
          ...results,
          role: roleId.role,
          roleId: roleId._id,
        },
      });
    }
    hcb(null, null)
  });
};

/**
 * fetch user list
 * @param {Object} userInfo
 * @param {Object} queryParams
 * @returns
 */
const usersList = ({ role: userRole }, { q = '', limit = 10, offset = 0, status = null, trialRequest = null, quotaRequest = null, isTrialAccount = null, isTrialAccountSuspended = null, sortBy = 'updatedAt', orderBy = 'DESC' }, hcb) => {
  let criteria = {
    isDeleted: false
  };
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  if (q) {
    /* eslint-disable no-useless-escape */
    q = q.replace('/[\/,+]/g', '\\$&');
    criteria = {
      ...criteria,
      $or: [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }]
    };
  }
  if (typeof isTrialAccount === 'boolean') {
    if (isTrialAccount) {
      criteria.isTrialAccount = isTrialAccount;
    } else {
      criteria.isTrialAccount = { $nin: [true] }
    }
  }
  if (typeof status === 'boolean') {
    criteria.status = status;
  }
  if (typeof isTrialAccountSuspended === 'boolean') {
    if (isTrialAccountSuspended) {
      criteria.isTrialAccountSuspended = isTrialAccountSuspended;
    } else {
      criteria.isTrialAccountSuspended = { $nin: [true] }
    }
  }
  if (trialRequest) {
    criteria.trialRequest = trialRequest
  }
  if (quotaRequest) {
    criteria.quotaRequest = quotaRequest
  }
  const lookups = [{
    collection: 'roles',
    localField: 'roleId',
    foreignField: '_id',
    outputKey: 'roleData',
  },
  {
    collection: 'tenantsettings',
    localField: 'tenantId',
    foreignField: 'tenantId',
    outputKey: 'setting',
  },
  {
    collection: 'tenants',
    localField: 'tenantId',
    foreignField: '_id',
    outputKey: 'company',
  }
  ];
  auto({
    role: (cb) => {
      roleService.findOne({ role: userRole }, null, null, cb);
    },
    users: ['role', ({ role }) => {
      criteria = { ...criteria, roleId: { $nin: [role._id] } }
      userService
        .findAllByAggregation(
          criteria,
          {
            tmpPassword: 0, password: 0
          },
          lookups,
          sortObj,
          offset,
          limit,
          (err, result) => {
            if (err) {
              return hcb(err);
            }
            const { dataList, count } = result[0];
            const totalCount = count[0] && count[0].count ? count[0].count : 0;
            const mappedResponse = dataList.map((item) => {
              const { roleData = [], setting = [], company = [], ...user } = item;
              const userData = { ...user };
              userData.setting = setting && setting[0];
              userData.role = roleData && roleData[0].role;
              userData.companyName = company && company[0] && company[0].name;
              if (!userData.setting) {
                userData.setting = {
                  storageLimit: 25000,
                  storageUsed: 0
                }
              }
              return userData;
            });
            return hcb(null, {
              data: mappedResponse,
              totalCount,
            });
          },
        );
    }]
  }, (err, { users }) => {
    if (err) {
      hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      ...users,
    })
  })
};

/**
 * users detail
 * @param {Object} userInfo
 * @param {Oject} params
 * @returns
 */
const usersDetail = (_, { id: recordId }, hcb) => {
  _userProfile({ id: recordId }, (err, response) => {
    if (err) {
      hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      ...response,
    });
  });
};

/**
 * users create
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const usersCreate = ({ id, globalMappingDisabled }, payload, hcb) => {
  const password = payload.password || generateAlphaNumericString();
  auto({
    hashPassword: (cb) => {
      hashPasswordCb(password, 10, (err, hash) => {
        if (err) {
          return cb(err);
        }
        let body = {
          ...payload,
          status: true,
          password: hash,
          createdBy: id,
        };
        if (!payload?.password) {
          body = {
            ...body,
            tmpPassword: password,
          };
        }
        return cb(null, body);
      });
    },
    checkTenant: ['hashPassword', (results, cb) => {
      let body = results.hashPassword;
      if (body.tenant) {
        return parallel({
          role: (pcb) => {
            roleService.findOne({ role: ROLES_ENTERPRISE_ADMIN }, { role: 1 }, (err, result) => {
              if (err) {
                return pcb(err);
              }
              return pcb(null, result);
            });
          },
          tenant: (pcb) => {
            tenantService.update({ name: payload.tenant, status: true }, { name: payload.tenant, status: true }, { upsert: true, new: true }, (err, result) => {
              if (err) {
                return pcb(err);
              }
              return pcb(null, result);
            });
          },
        }, (err, pResults) => {
          if (err) {
            return cb(err);
          }
          const { role, tenant } = pResults;
          body = {
            ...body,
            roleId: role._id,
            tenantId: tenant._id,
          };
          return cb(null, body);
        });
      }
      body = {
        ...body,
        roleId: payload.roleId,
      };
      return cb(null, body);
    }],
    createuser: ['checkTenant', (results, cb) => {
      userService.create(results.checkTenant, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    }],
    profile: ['createuser', (results, cb) => {
      _userProfile({ id: results.createuser._id }, (err, response) => {
        if (err) {
          return cb(err);
        }
        return cb(null, response.data);
      });
    }],
    mappingCreate: ['profile', (results, cb) => {
      if (results.profile.tenantId && !globalMappingDisabled) {
        globalMappingController.mappingCreateCallback(
          { userId: id, tenantId: results.profile.tenantId }, (err, result) => {
            if (err) {
              return cb(err);
            }
            return cb(null, result);
          },
        );
      } else {
        return cb(null, null);
      }
    }],
  }, (err, result) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.CREATED,
      ...result,
    });
  });
};

/**
 * users update
 *@param {Object} userInfo
 * @param {Object} params
 * @param {Object} payload
 * @returns
 */
const usersUpdate = ({ id }, { id: recordId }, payload, hcb) => {
  if (!Object.keys(payload).length) {
    return hcb(null, { statusCode: 400, message: "Payload is empty Invalid" });
  }
  const { expiryInDays } = payload;
  let sendWelcomeMail = false;
  auto({
    isEmailExist: (cb) => {
      userService.findOne(
        { _id: { $ne: recordId }, email: payload.email },
        null,
        null,
        null,
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
    hash: (cb) => {
      if (payload.password) {
        hashPasswordCb(payload.password, 10, (err, res) => cb(err, res));
      } else {
        cb(null, false)
      }
    },
    user: (cb) => {
      if (payload.extendStorage || payload.expiryInDays) {
        userService.findOne(
          { _id: recordId },
          null,
          null,
          null,
          cb
        );
      } else {
        cb(null, false)
      }
    },
    tenantSetting: ['user', 'isEmailExist', ({ isEmailExist, user }, cb) => {
      if (user && !isEmailExist && payload.extendStorage) {
        TENANT_SETTINGS.findOneAndUpdate({ tenantId: user.tenantId }, { $inc: { storageLimit: +payload.extendStorage } }, { upsert: true, new: true }, cb);
      } else {
        cb(null, false)
      }
    }],
    updateUser: ['isEmailExist', 'hash', 'user', ({ isEmailExist: isExist, hash, user }, cb) => {
      if (isExist) {
        return cb(null, {
          ...{ message: `Email (${payload.email}) is not allowed` },
        });
      }
      const dataToSet = {
        ...payload
      };
      dataToSet.updatedBy = id;
      if (expiryInDays) {
        if (!user.trialEndDate || moment().isAfter(user.trialEndDate)) {
          dataToSet.trialEndDate = moment().add(expiryInDays, 'days').toDate();
        } else {
          dataToSet.trialEndDate = moment(user.trialEndDate).add(expiryInDays, 'days').toDate();
        }
        delete dataToSet.expiryInDays;
      }
      if (hash) {
        dataToSet.password = hash;
      }
      if (payload.status) {
        dataToSet.approvedOn = new Date();
        dataToSet.isTrialAccountSuspended = false
        if (!user.approvedOn && user.isTrialAccount) {
          sendWelcomeMail = true;
        }
      }
      if (payload.trialRequest) {
        dataToSet.trialRequest = payload.trialRequest
      }
      if (payload.quotaRequest) {
        dataToSet.quotaRequest = payload.quotaRequest
      }
      console.log("HHHHHHHHHHHHHHHHHHHHHHHHHHh", JSON.stringify(dataToSet))
      userService.update(
        { _id: recordId, isDeleted: false }, { $set: dataToSet }, { new: true, lean: true }, (err, response) => {
          if (err) {
            return cb(err);
          }
          return cb(null, response);
        },
      );
    }],
    fetchUser: (cb) => {
      userService.findOne({ _id: recordId }, null, { lean: true }, null, cb)
    },
    createParalelUser: ['fetchUser', 'updateUser', ({ fetchUser: user }, cb) => {
      if (!sendWelcomeMail || !user) {
        return cb(null, false)
      }
      const data = user
      delete data._id
      data.isTrialAccount = false
      data.status = true
      data.email = `${data.email.split("@")[0]}@amygbadmin.ai`;
      data.password = '$2b$10$Jmuay/X3UMyeSs8kyyPdEuYWob7J3M3dQlMyYX021706jOftaabx.' // Gsva#123bnm
      data.tmpPassword = 'Gsva#123bnm'
      userService.create(data, cb)
    }]
  }, (err, { user, updateUser, tenantSetting, createParalelUser }) => {
    if (err) {
      return hcb(err);
    }
    hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.UPDATED,
      data: { ...updateUser, setting: tenantSetting }
    });
    const templateData = {
      email: updateUser.email,
      firstName: updateUser.firstName,
      lastName: updateUser.lastName,
      expiryInDays: expiryInDays || TRIAL_ACCOUNT.EXPIRY_IN_DAYS,
      url: TRIAL_ACCOUNT.URL,
      password: updateUser.tmpPassword,
    };
    const templateDataParalelUser = {
      ...templateData,
      email: createParalelUser.email,
      firstName: createParalelUser.firstName,
      lastName: createParalelUser.lastName,
      password: 'Gsva#123bnm'
    }
    if (sendWelcomeMail) {
      // remove sensitive data
      delete updateUser.password;
      delete updateUser.tmpPassword;
      ImcAPIEndPoints.sendEmail({
        subject: TRIAL_ACCOUNT.SUBJECT,
        emails: `${updateUser.email}, ${TRIAL_ACCOUNT.TEAM_EMAILS}`,
        body: APPROVE_CUSTOMER_TEMPLATE(templateData),
      }).then(() => { }).catch(() => { });
      ImcAPIEndPoints.sendEmail({
        subject: TRIAL_ACCOUNT.SUBJECT,
        emails: `${TRIAL_ACCOUNT.TEAM_EMAILS}`,
        body: APPROVE_CUSTOMER_TEMPLATE(templateDataParalelUser),
      }).then(() => { }).catch(() => { });
    }
    if (payload.extendStorage) {
      templateData.extendStorage = `${(+payload.extendStorage) / 1000} Megabytes`;
      ImcAPIEndPoints.sendEmail({
        subject: 'VisionERA (Quota Increase Activation)',
        emails: `${updateUser.email}`,
        body: APPROVE_STORAGE(templateData),
      }).then(() => { }).catch(() => { });
    }

    if (user && user.approvedOn && user.isTrialAccount && expiryInDays) {
      ImcAPIEndPoints.sendEmail({
        subject: 'VisionERA (Trial Extension Activation)',
        emails: `${updateUser.email}`,
        body: APPROVE_EXTENSION(templateData),
      }).then(() => { }).catch(() => { });
    }
  });
};

/**
 * users delete
 * @param {Object} userInfo
 * @param {Object} params
 * @returns
 */
const usersDelete = async ({ id }, { id: recordId }, hcb) => {
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
  };
  userService.update({ _id: recordId }, { $set: dataToSet }, {}, (err, response) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DELETED,
      ...response,
    });
  });
};
const userWorkFlowList = (
  { tenantId },
  { q = '', fields = null, isPublished = null, limit = 0, offset = 0, sortBy = 'createdAt', orderBy = 'DESC' },
  hcb
) => {
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  const query = {
    tenantId: createMongooseId(tenantId),
    isDeleted: false,
  };
  let projection = { workflow: 1, aiServerId: 1 };
  if (q) {
    query.workflow = {
      $regex: new RegExp(q, 'i'),
    };
  }
  if (fields) {
    const fieldsArray = fields.split(',');
    if (fields.length) {
      projection = {};
      fieldsArray.forEach((field) => {
        projection[field] = 1;
      });
    }
  }
  if (typeof isPublished === 'boolean') {
    query.published = isPublished;
  }
  const lookups = [];
  const pagination = {
    offset,
    limit,
    sort: sortObj,
  };
  workflowService.findAllByAggregation(
    query, projection, lookups, pagination, (err, result) => {
      if (err) {
        return hcb(err);
      }
      const { dataList, count } = result[0];
      const totalCount = count[0] && count[0].count ? count[0].count : 0;
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: dataList,
        totalCount,
      });
    },
  );
}
module.exports = {
  checkUniqueEmail,
  checkUniqueTenant,
  usersList,
  usersDetail,
  usersUpdate,
  usersCreate,
  usersDelete,
  userWorkFlowList
};
