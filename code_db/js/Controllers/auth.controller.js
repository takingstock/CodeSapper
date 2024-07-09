const config = require('config');
const bcrypt = require('bcrypt');
const moment = require('moment');
const { auto, eachSeries } = require('async');

const { userService, roleService, tenantService, workflowService } = require('../Services');
const rateLimitingCtrl = require('./rate-limiting-controller');
const globalMappingController = require('./global-mapping.controller');
const workflowsController = require('./workflows.controller');
const idpApiKeController = require('./idp-key.controller')
const { verifyLocalCaptcha } = require('./recaptcha-controller')
const { setToken, verifyToken, expireToken } = require('../Utils/token-manager.util');
const { generateAlphaNumericString, hashPassword, hashPasswordCb, createNewMongooseId } = require('../Utils/universal-functions.util');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const sales = require('../Utils/sales');

const TENANT_SETTINGS = require('../Models/tenant-setting.model')
const { SIGNUP_TEMPLATE } = require('../Helpers/emailTemplates');

const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const ROLES = config.get('ROLES');
const ROLES_ENTERPRISE_ADMIN = ROLES.TENANT;
const TRIAL_ACCOUNT = config.get('TRIAL_ACCOUNT');
let userWorkflows = config.get('TRIALUSER_WORKFLOWS_DEFAULT');
const FRONT_END = config.get('FRONT_END')
const FRONT_END_URL = process.env.FRONTEND_HOST || FRONT_END[process.env.NODE_ENV || 'development']
let USERS = []
if (process.env.NODE_ENV.includes('mark') || process.env.NODE_ENV.includes('scalar')) {
  userWorkflows = config.get('WORKFLOWS_MARK')
}
const isValidOtp = (email, otp) => {
  const user = USERS.filter(u => u.email === email && u.otp === otp)
  if (user[0]) {
    USERS = USERS.filter(u => u.email !== email && u.otp !== otp)
    return true
  }
  return false
}
/**
 * compare password
 * @param {Object} payload
 * @param {Object} user
 * @returns
 */
const comparePassword = (payload, user, callback) => {
  bcrypt.compare(payload.password, user.password, (err, result) => callback(err, result));
};
/**
 * login user
 * @param {Object} payload
 * @returns
 */
const loginUser = (payload, hcb) => {
  const criteria = {
    email: payload.email,
    status: true,
  };
  const option = {
    lean: true,
  };
  const populateArray = [{
    path: 'roleId',
    fields: '_id role',
  }];
  // console.log("START LOGIN", criteria)
  auto({
    checkCaptcha: (cb) => {
      if (payload.randomNumber === "internal_captcha") {
        return cb(null, null)
      }
      const payloadForCaptcha = {
        randomNumber: payload.randomNumber,
        uniqueId: payload.uniqueId,
      }
      verifyLocalCaptcha(payloadForCaptcha, (err, validCaptcha) => {
        if (err) {
          cb(err)
        } else if (validCaptcha) {
          cb()
        } else {
          cb(HTTP_ERROR_MESSAGES.INVALID_CAPTCHA)
        }
      })
    },
    user: ['checkCaptcha', (_, cb) => {
      // console.log("user LOGIN 449")
      userService.findOne(criteria, null, option, populateArray, (err, user) => {
        // console.log("user LOGIN 449", err, user)

        if (err) {
          return cb(err)
        }
        if (!user) {
          return cb(HTTP_ERROR_MESSAGES.USER_NOT_FOUND);
        }
        if (user.isTrialAccount) {
          if (user.isTrialAccountSuspended) {
            return cb(HTTP_ERROR_MESSAGES.TRIAL_ACCOUNT_SUSPENDED);
          }
          const trialEndDate = moment(user.trialEndDate);
          const now = moment();
          if (trialEndDate.isBefore(now)) {
            return cb(HTTP_ERROR_MESSAGES.TRIAL_ACCOUNT_EXPIRED);
          }
        }
        return cb(null, user)
      })
    }],
    limitStatus: ['user', ({ user }, cb) => {
      rateLimitingCtrl.checkLimitEntry(payload.ip, user._id, null, (err, limitStatus) => {
        // console.log("limitStatuslimitStatus", limitStatus)
        if (limitStatus === 'ACCESS_DENIED') {
          return cb(HTTP_ERROR_MESSAGES.TOO_MANY_REQUESTS);
        }
        return cb(null, limitStatus)
      });
    }],
    validPassword: ['user', 'limitStatus', ({ user }, cb) => {
      comparePassword(payload, user, cb);
    }],
    match: ['validPassword', ({ validPassword, user }, cb) => {
      rateLimitingCtrl.updateLimitEntry(payload.ip, user._id, null, validPassword, () => {
        if (!validPassword) {
          if (user.failedLoginAttempts && user.failedLoginAttempts >= 4) {
            return cb(HTTP_ERROR_MESSAGES.USER_LOCKED);
          }
          // update failed login count
          userService.update(
            { _id: user._id },
            { $set: { failedLoginAttempts: user.failedLoginAttempts + 1 } },
            null,
            (err) => {
              if (err) {
                return cb(err)
              }
              return cb(HTTP_ERROR_MESSAGES.INVALID_USER_PASS);
            }
          );
        } else {
          const userDetails = { lastLoginDate: new Date() }
          if (!user.firstLoginDate) {
            userDetails.firstLoginDate = user.firstLoginDate
          }
          userService.update(
            { _id: user._id },
            { $set: userDetails },
            null,
            () => cb(null, validPassword)
          )
        }
      });
    }],
    token: ['match', ({ user }, cb) => {
      setToken({
        id: user._id,
        email: user.email,
        role: user.roleId.role,
        tenantId: user.tenantId || null,
      }, cb);
    }],
    userData: ['user', ({ user }, cb) => {
      const userData = {
        _id: user._id,
        email: user.email,
        role: user?.roleId?.role || null,
        role_id: user.roleId._id,
        isTrialAccount: user.isTrialAccount || null,
        trialEndDate: user.trialEndDate || null,
        trialRequest: user.trialRequest || null,
        quotaRequest: user.quotaRequest || null
      };
      if (user?.roleId?.role !== ROLES.SUPER_ADMIN) {
        userData.tenantId = user.tenantId || null;
      }
      return cb(null, userData)
    }],
    updateUser: ['userData', 'token', ({ user }, cb) => {
      userService.update(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0, lastLoginDate: new Date() } },
        null,
        (err, res) => {
          return cb(null, res)
        }
      )
    }],
    storage: ['userData', ({ userData }, cb) => {
      TENANT_SETTINGS.findOne({ tenantId: userData.tenantId }, (err, Setting) => {
        if (err) {
          cb(err)
        }
        if (!Setting) {
          new TENANT_SETTINGS({ tenantId: userData.tenantId }).save(cb)
        } else {
          cb(null, Setting)
        }
      })
    }]
  }, (err, { token, userData, storage }) => {
    if (err) {
      console.log("GGGGGGG", err)
      return hcb(err)
    }
    const { accessToken } = token;

    return hcb(null, {
      accessToken,
      user: {
        ...userData,
      },
      storage
    })
  })
};
/**
 * users create
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const registerUser = (payload, hcb) => {
  const password = payload.password || generateAlphaNumericString();
  const companyName = payload.companyName || createNewMongooseId().toString()
  auto({
    findUser: (cb) => {
      userService.findOne({ email: payload.emailId }, {}, {}, null,
        (err, result) => {
          if (err) {
            return cb(err)
          }
          if (result) {
            return cb(HTTP_ERROR_MESSAGES.EMAIL_ALREADY_EXIST);
          }
          return cb(null, null);
        })
    },
    verifyOtp: ['findUser', (_, cb) => {
      if (payload.otp && !isValidOtp(payload.emailId, payload.otp)) {
        return cb({
          ...HTTP_ERROR_MESSAGES.INVALID_OTP
        })
      }
      return cb(null, null);
      // tenantService.findOne({ name: companyName }, {}, {},
      //   (err, result) => {
      //     if (err) {
      //       return cb(err)
      //     }
      //     if (!result) {
      //       return cb(null, null);
      //     }
      //     return cb(HTTP_ERROR_MESSAGES.TENANT_ALREADY_EXIST);
      //   })
    }],
    hashPassword: ['verifyOtp', (_, cb) => {
      hashPassword(password)
        .then((hash) => {
          let body = {
            ...payload,
            status: false,
            password: hash,
          };
          if (!payload?.password) {
            body = {
              ...body,
              tmpPassword: password,
            };
          }
          return cb(null, body);
        })
        .catch((err) => cb(err));
    }],
    checkTenant: ['hashPassword', (results, cb) => {
      let body = results.hashPassword;
      roleService.findOne({ role: ROLES_ENTERPRISE_ADMIN }, { role: 1 }, {}, (err, result) => {
        if (err) {
          return cb(err);
        }
        body = {
          ...body,
          roleId: result._id
        };
        return cb(null, body);
      })
    }],
    createTenant: ['checkTenant', (results, cb) => {
      tenantService.create({ name: companyName, status: false }, (err, result) => {
        if (err) {
          return cb(err)
        }
        const body = {
          ...results.checkTenant,
          tenantId: result._id
        };
        return cb(null, body);
      })
    }],
    createUser: ['createTenant', (results, cb) => {
      const dataToSave = results.createTenant;
      if (payload.emailId) {
        dataToSave.email = dataToSave.emailId;
        delete dataToSave.emailId;
      }
      dataToSave.isTrialAccount = true;
      dataToSave.status = false;
      dataToSave.trialEndDate = moment().add(payload?.EXPIRY_IN_DAYS || TRIAL_ACCOUNT.EXPIRY_IN_DAYS, 'days').toDate();
      userService.create(dataToSave, (err, result) => {
        if (err) {
          return cb(err)
        }
        cb(null, result)
      })
    }],
    mappingCreate: ['createUser', (results, cb) => {
      globalMappingController.mappingCreateCallback(
        { userId: results.createUser._id, tenantId: results.createUser.tenantId },
        (err, result) => {
          if (err) {
            return cb(err)
          }
          cb(null, result);
        }
      )
    }],
    createDefaultIdpKey: ['createUser', ({ createUser }, cb) => {
      // create default Idp api key
      idpApiKeController.createKey(createUser._id, cb)
    }]
  }, (err, result) => {
    if (err) {
      console.log("ERROR 464", err)
      return hcb(err);
    }
    const { createUser } = result;
    // remove sensitive data
    delete createUser.password;
    delete createUser.tmpPassword;
    hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.CREATED
    });

    // function after sending response to improve performance
    /* eslint-disable no-use-before-define */

    ImcAPIEndPoints.sendEmail({
      subject: "Welcome",
      emails: payload.emailId,
      body: SIGNUP_TEMPLATE()
    })
      .then(() => { console.log("Welcome mail send to createUser.email stack hoders", payload.emailId) })
      .catch(e => console.log(e))
    ImcAPIEndPoints.sendEmail({
      emails: TRIAL_ACCOUNT.NEW_SIGNUP_ALERT_EMAILS,
      subject: `New Trial Request for VisionERA`,
      body: `
      Hi <br>
      ${payload.firstName} ${payload.lastName || ''} has requested a Trial for VisionERA..<br>
      email ${payload.emailId}
      `,
    })
      .then(() => { console.log("mail send to internal stack hoders") })
      .catch(e => console.log(e))
    createDefaultWorkflow(result.createUser._id, result.createUser.tenantId, 'USER');
    sales.trialRequest(payload);
  });
};
/**
 * Create default wworkflows
 */
const createDefaultWorkflow = (userId, tenantId, createdVia) => {
  auto({
    mappingFetch: (cb) => {
      globalMappingController.mappingUpdateCreateCallback(
        { userId, tenantId }, (err, result) => {
          if (err) {
            return cb(err);
          }
          return cb(null, result)
        }
      );
    },
    userWorkflows: ['mappingFetch', ({ mappingFetch }, wcb) => {
      const mapping = mappingFetch || []
      if (tenantId) {
        eachSeries(userWorkflows, (w, cb) => {
          const workflowConfig = {
            status: w.status,
            name: w.workflow || w.name,
            primaryDocId: mapping.filter(d => w.primaryDocSlug === d.seedId).map(m => m._id)[0] || null,
            docIds: mapping.filter(d => w.docSlugs[d.seedId]).map(m => ({ docId: m._id, docType: m.documentType })) || [],
            country: w.country,
            createdVia,
            static: w.static || false,
            published: w.status === 'Published',
            variablesInFlow: {
              derived: [],
              ocr: mapping.filter(d => w.docSlugs[d.seedId]).map(gm => {
                const g = {
                  docId: gm._id,
                  documentType: gm.documentType,
                  variables: gm.mapping.map(m => ({ selected: true, key: m.key, exportKey: m.exportKey || m.key })) || [],
                  columns: gm.columns || []
                }
                return g
              }),
              qr: []
            }
          };
          // console.log("workflowConfig workflowConfig workflowConfig", workflowConfig)
          // console.log("mapping mapping mapping", mapping.length)

          workflowService.findOne({ tenantId, workflow: workflowConfig.name }, null, null, null, (err, workflowExists) => {
            if (!workflowExists) {
              workflowsController.createWorkflow({ tenantId },
                workflowConfig, (err) => {
                  if (err) {
                    return cb(err)
                  }
                  return cb(null, true)
                });
            } else {
              workflowService.update({ tenantId, workflow: workflowConfig.name }, { $set: workflowConfig }, null, (err) => {
                if (err) {
                  return cb(err)
                }
                // console.log("updted")
                return cb(null, true)
              })
            }
          })
        }, (err, result) => {
          if (err) {
            return wcb(err)
          }
          return wcb(null, result)
        })
      } else {
        wcb(null, true);
      }
    }]
  })
}

/**
 * Forgot password
 */

const forgotPassword = ({ email }, hcb) => {
  auto({
    user: (cb) => {
      userService.findOne({ email }, null, null, null, cb)
    },
    createToken: ['user', ({ user }, cb) => {
      setToken({
        id: `forgot_${user._id}`,
        email: user.email,
        role: user.roleId.role,
        tenantId: user.tenantId || null,
      }, cb);
    }],
    sendForgotEmail: ['createToken', ({ createToken, user }, cb) => {
      // FRONT_END_URL
      const { accessToken } = createToken;
      ImcAPIEndPoints.sendEmail({
        emails: user.email,
        subject: `Forgot Password Request`,
        body: `
        Hi <br>
        Click <a href ="${FRONT_END_URL}password/${encodeURIComponent(accessToken)}" > Here</a> to Change your password <br>
      `,
      })
        .then(() => {
          // console.log("reset password", FRONT_END_URL)
          cb()
        })
        .catch(e => {
          console.log(e)
          cb(e)
        })
    }]
  }, () => {
    hcb(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
  })
}

/**
 * Change password
 */

const changePassword = ({ token, password }, hcb) => {
  auto({
    tokenVerify: (cb) => {
      verifyToken(decodeURIComponent(token)).then(response => {
        const user = response.user
        user.id = user.id.split('orgot_')[1]
        cb(null, user)
      }).catch(cb)
    },
    user: ['tokenVerify', ({ tokenVerify }, cb) => {
      userService.findOne({ _id: tokenVerify.id }, null, null, null, (err, user) => {
        if (user) {
          return cb(null, user)
        }
        cb('Invalid Token')
      })
    }],
    tokenExpire: ['tokenVerify', (_, cb) => {
      expireToken(decodeURIComponent(token), cb)
    }],
    hashPassword: ['tokenVerify', (_, cb) => {
      hashPasswordCb(password, 10, cb)
    }],
    update: ['user', 'hashPassword', ({ user, hashPassword }, cb) => {
      userService.update({ _id: user._id }, { $set: { password: hashPassword } }, null, cb)
    }]
  }, (err) => {
    if (err) { return hcb(err) }
    hcb(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
  })
}
const _generateOTP = () => {
  // Declare a digits variable
  // which stores all digits
  const digits = '0123456789';
  let OTP = '';
  for (let i = 0; i < 6; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
}

const requestEmailVerification = (query, hcb) => {
  const { email } = query
  auto({
    generateOtp: (cb) => {
      const otp = _generateOTP()
      const user = { email, otp }
      USERS.push(user)
      const emailAddress = email
      setTimeout(() => {
        console.log("timeout for otp", isValidOtp(emailAddress, otp))
      }, 5 * 60 * 1000)
      cb(null, otp)
    },
    sendEmail: ['generateOtp', ({ generateOtp }, cb) => {
      ImcAPIEndPoints.sendEmail({
        emails: email,
        subject: `New Trial Request for VisionERA`,
        body: `
        Hi,<br>
        The OTP for VisionERA Trial registration is ${generateOtp}.
        `,
      })
      cb(null, true)
    }]
  }, (err) => {
    if (err) { return hcb(err) }
    hcb(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
  })
}
module.exports = {
  loginUser,
  registerUser,
  createDefaultWorkflow,
  forgotPassword,
  changePassword,
  requestEmailVerification
};
