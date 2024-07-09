const config = require('config');
// const async = require('async');
const { auto, eachLimit } = require('async');
const { userService, teamsService, customersService, roleService } = require('../Services');

const {
  hashPassword,
  createMongooseId,
  generateAlphaNumericString,
} = require('../Utils/universal-functions.util');

const { EMIT_EVENT } = require('../Utils/data-emitter.util');

const APP_EVENTS = config.get('APP_EVENTS');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
// const details = (payload, cb )=> {
// }
const details = (usersArray, projection = null, cb) => {
  // console.log("userArray", usersArray)
  const project = projection || { email: 1 }
  const criteria = {
      _id: { $in: usersArray.map(e => createMongooseId(e)) },
      isDeleted: false
  }
  // console.log("criteria inUSer array", criteria)
  userService.findAll(criteria, project, { lean: true }, (err, response) => {
      if (err) {
          return cb(err);
      }
      // console.log("FINALARR-->", response)
      return cb(null, response);
  });
}

const teamDetails = (userId, projection = null, cb) => {
  // console.log("userArray", usersArray)
  const project = projection || { teamName: 1 }
  const criteria = { $or: [{
      indexerArray: userId }, { superVisorId: userId }]
  }
  // console.log("criteria inUSer array", criteria)
  teamsService.findAll(criteria, project, { lean: true }, (err, response) => {
      if (err) {
          return cb(err);
      }
      // console.log("FINALARR-->", response)
      return cb(null, response);
  });
}
/**
 * users create
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const createUser = ({ id, tenantId }, payload, hcb) => {
  // if ((!(payload.teamName || payload.teamId) && (payload.superVisorIds.length === 0)) || ((payload.teamName || payload.teamId) && (payload.superVisorIds))) {
  //   return hcb(HTTP_ERROR_MESSAGES.WRONG_PAYLOAD)
  // }
  // let teamId = null
  let indexerId = null;
  let superVisorId = null;
  let superVisorData = null;
  let indexerDetails = {};
  let adminRes = {}
  // let sup
  let data = null;
  // console.log("payload---->", payload)
  payload.email = payload.email.toLowerCase()
  // console.log("payload---->", payload)
  auto({
    isEmailExist: (cb) => {
      if (payload.email) {
        userService.findOne(
          { email: payload.email, isDeleted: false },
          {}, {}, null,
          (err, response) => {
            if (err) {
              return cb(err);
            }
            // console.log(response)
            if (response) {
              return cb(HTTP_ERROR_MESSAGES.EMAIL_ALREADY_EXIST);
            }
            cb()
          },
        );
      } else {
        cb()
      }
    },
    getRole: ['isEmailExist', (res, cb) => {
      const criteria = { _id: payload.roleId };
      roleService.findOne(criteria, {}, {}, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (result) {
          data = result;
          // console.log(data)
        } else {
          return cb(HTTP_ERROR_MESSAGES.ROLE_ID_NOT_FOUND)
        }
        cb()
      });
    }],
    hashPassword: (cb) => hashPassword(payload.password).then((hash) => cb(null, hash)),
    createUser: ['hashPassword', 'getRole', (results, cb) => {
      const { hashPassword: hash } = results;
      let body = {}
      // as of now only indexer is gonna get created
      const payloadCopy = { ...payload }
      if (payload.superVisorIds && payload.superVisorIds.length && data.role === 'ENTERPRISE_INDEXER') {
        // console.log("INNNNNNNN")
        auto({
          createIndexer: (ecb) => {
            // delete payloadCopy.teamId
            delete payloadCopy.teamName
            delete payloadCopy.superVisorIds
            body = {
              ...payloadCopy,
              isDeleted: false,
              tenantId,
              status: true,
              password: hash,
              createdBy: id,
            };
            userService.create(body, (err, response) => {
              if (err) {
                console.log("ER===>", err)
                return ecb(err);
              }
              // console.log("BOTH---", err, response)
              indexerId = response._id
              const dataString = JSON.stringify(response)
              const parsed = JSON.parse(dataString);
              indexerDetails = parsed

              return ecb();
            });
          },
          getTeamNameForIndexer: ['createIndexer', (res, ecb) => {
            const criteria = {
              superVisorId: { $in: payload.superVisorIds }
            }
            teamsService.findAll(criteria, { teamName: 1 }, { lean: true }, (err, response) => {
              if (err) {
                return ecb(err);
              }
              // console.log("response TEAM NAME -->", response)
              indexerDetails['teams'] = response
              delete indexerDetails.password
              // console.log("FINALARR-->", response)
              return ecb();
            });
          }],
          addSuperVisorDetails: ['createIndexer', (res, ecb) => {
            details(payload.superVisorIds, null, (err, response) => {
              // console.log(payload.superVisorIds)
              // console.log("err, response----->", err, response)
              if (err) {
                // console.log("err>", err)
                return ecb(err)
              }
              indexerDetails['superVisorIds'] = response || []
              ecb()
            })
          }]

        }, (err) => {
          if (err) {
            return cb(err);
          }
          // console.log("result.createUser===", result.createUser)
          cb()
        })
      } else if (data.role === 'ENTERPRISE_ADMIN') {
        delete payload.teamName
        // delete payload.superVisorIds
        body = {
          ...payload,
          isDeleted: false,
          tenantId,
          status: true,
          password: hash,
          createdBy: id,
        };
        userService.create(body, (err, response) => {
          if (err) {
            // console.log("ER===>", err)
            return cb(err);
          }
          // console.log("Admin---", response)
          // indexerId = response._id
          // let res = null;
          const dataString = JSON.stringify(response)
          const parsed = JSON.parse(dataString);
          adminRes = parsed
          delete adminRes.password
          adminRes['superVisorIds'] = payload.superVisorIds || []
          // return cb(null, {
          //   ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          //   data: res,
          // });
          return cb()
        });
      } else {
        cb()
      }
    }],
    'addIndexDetailsToTeam': ['createUser', (res, cb) => {
      // if (res.createdUser)
      if (data.role === 'ENTERPRISE_INDEXER') {
        if (payload.superVisorIds && payload.superVisorIds.length) {
          // this will push the indexId in the IndexerArr of teams schema
          const dataToSet = { $addToSet: { indexerArray: indexerId }, updatedBy: id }
          // $in : [payload.superVisorIds]
          teamsService.updateAll({ superVisorId: { $in: payload.superVisorIds } }, dataToSet, { lean: true, new: true }, (err) => {
            if (err) {
              return cb(err);
            }
            // teamId = response._id
            // console.log("Indexer Update Response", response)
            return cb()
          });
        } else {
          cb()
        }
      } else {
        cb()
      }
    }],
    createSuperVisor: ['addIndexDetailsToTeam', (res, cb) => {
      if (data.role === 'ENTERPRISE_SUPERVISOR') {
        if (payload.teamName || payload.teamId) {
          // console.log("REACHED HERE----")
          auto({
            hashPassword: (ecb) => hashPassword(payload.password).then((hash) => ecb(null, hash)),
            createUser: ['hashPassword', (results, ecb) => {
              const { hashPassword: hash } = results;
              const payloadCopy = { ...payload }
              // as of now only superVisor is gonna get created
              delete payloadCopy.teamId
              delete payloadCopy.teamName
              delete payloadCopy.superVisorIds
              const body = {
                ...payloadCopy,
                isDeleted: false,
                tenantId,
                status: true,
                password: hash,
                createdBy: id,
              };
              userService.create(body, (err, response) => {
                if (err) {
                  // console.log("ER===>", err)
                  return ecb(err);
                }
                // console.log("BOTH---", err, response)
                superVisorId = response._id
                const dataString = JSON.stringify(response)
                const parsed = JSON.parse(dataString);
                superVisorData = parsed
                // superVisorData = response
                ecb();
              });
            }],
          }, (err) => {
            if (err) {
              return cb(err);
            }
            // console.log("result.createUser===", result)
            // superVisorData = result.createUser
            cb()
          })
        } else {
          cb()
        }
      } else {
        cb()
      }
    }],
    'updateInTeam': ['createSuperVisor', (res, cb) => {
      // let flag = false;
      // THIS WILL ONLY BE DONE IF WE ARE DOING IT FOR SUPERVISOR FOR INDEXER WE WILL SKIP THIS
      if (data.role === 'ENTERPRISE_SUPERVISOR') {
        if (payload.teamName) {
          // console.log("INSIDE TEAM=====")
          const body = {
            teamName: payload.teamName,
            superVisorId,
            tenantId,
            createdBy: id,
          };
          // console.log("create team pay:::", body)
          teamsService.create(body, (err, response) => {
            if (err) {
              return cb(err);
            }
            // teamId = response._id
            cb(null, {
              ...HTTP_SUCCESS_MESSAGES.DEFAULT,
              response
            });
          });
        } else {
          return cb(HTTP_ERROR_MESSAGES.TEAM_NAME_NOT_FOUND)
        }
      } else {
        cb()
      }
    }],
    'addCustomerToTeam': ['updateInTeam', (res, cb) => {
      // if (data.role === 'ENTERPRISE_SUPERVISOR') {
      if (payload.teamName) {
        auto({
          checkTeamExistInCustomers: (ecb) => {
            customersService.findOne({ teamName: payload.teamName, tenantId }, {}, { lean: true }, (err, response) => {
              if (response) {
                return ecb()
              }
              const dataToSet = {
                teamName: payload.teamName,
                tenantId
              }
              customersService.create(dataToSet, (err, res) => {
                if (err) {
                  console.log("customer error", err)
                  cb(err)
                } else {
                  // console.log("customers res:::", res)
                  cb(null, res)
                }
              })
            })
          }
        }, (err, result) => {
          if (err) {
            console.log("ERR In Customer AUTO Function", err);
            cb(err);
          }
          cb(null, result);
        })
      } else {
        cb()
      }
      // } else {
      //   cb()
      // }
    }],
    getTeamNameForIndexer: ['addCustomerToTeam', (res, ecb) => {
      if (payload.teamName || payload.teamId) {
        const criteria = {
          superVisorId: superVisorData._id
        }
        teamsService.findAll(criteria, { teamName: 1 }, { lean: true }, (err, response) => {
          if (err) {
            return ecb(err);
          }
          // console.log("response TEAM NAME -->", superVisorData)
          superVisorData['teams'] = response
          // console.log("superVisorData-->", response)
          return ecb();
        });
      } else {
        ecb()
      }
    }],
  }, (err) => {
    if (err) {
      return hcb(err);
    }
    if (data.role === 'ENTERPRISE_ADMIN') {
      return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: adminRes });
    }
    if (payload.teamName || payload.teamId) {
      return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: superVisorData });
    }
    // console.log("result======_", result)
    // return hcb(null, result.createUser);
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: indexerDetails,
    })
  });
};

const getUser = ({ id, tenantId }, payload, hcb) => {
  // console.log("payload", payload)
  const totalCount = 0
  let startIndex = null
  if (payload.pageNo) {
      startIndex = ((payload.pageNo) - 1) * payload.limit
      // endIndex = payload.pageNo * payload.limit
  }
  const criteria = {
    isDeleted: false,
    tenantId: createMongooseId(tenantId),
  }
  let userList = null
  if (payload._id) {
    criteria['_id'] = payload._id;
  } else {
    criteria['_id'] = { $nin: [createMongooseId(id)] }
  }
  if (payload.email) {
    // eslint-disable-next-line no-useless-escape
    const regEmail = payload.email.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    criteria['email'] = { $regex: regEmail, '$options': 'i' };
  }
  if (payload.roleId) {
    criteria['roleId'] = payload.roleId;
  }
  if (`isDefault` in payload) {
    criteria['isDefault'] = payload.isDefault;
  }

  // console.log("criteria getUser:::::", criteria)
  const teamsAll = {}
  const allCusotmers = {}
  // let roleName = null;
  auto({
    "getTotalUsersCount": (cb) => {
      userService.count(criteria, cb)
    },
    getUsers: (cb) => {
      userService.findAll(criteria, { firstName: 1, lastName: 1, email: 1, createdAt: 1, updatedAt: 1, roleId: 1, isDefault: 1 }, { lean: true, sort: { updatedAt: -1 }, skip: startIndex, limit: payload.limit }, (err, response) => {
        if (err) {
          cb(err);
        }
        // totalCount = response.length;
        // console.log("response getUser:::====>", payload.pageNo, response)
        userList = response
        return cb(null, {
          ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          userList,
          totalCount
        });
      });
    },
    getTeamIds: (cb) => {
      customersService.findAll({}, { teamName: 1, _id: 1 }, { lean: true, sort: { createdAt: -1 } }, (err, response) => {
        if (err) {
          cb(err);
        }
        for (const each of response) {
          allCusotmers[each.teamName] = each._id
        }
        // console.log("response--->", response);
        return cb();
      });
    },
    fetchTeamDetails: ['getUsers', 'getTeamIds', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        teamsService.findAll({ $or: [{ superVisorId: user._id }, { indexerArray: user._id }] }, { teamName: 1 }, {}, (err, res) => {
          if (err) {
            return callback(err)
          }
          // console.log("team res", res, user._id)
          const allTeams = {}
          for (const each of res) {
            if (!(each.teamName in allTeams)) {
              allTeams[each.teamName] = {
                _id: allCusotmers[each.teamName],
                teamName: each.teamName
              }
            }
          }
          const teamsArray = []
          for (const each in allTeams) {
            teamsArray.push(allTeams[each])
          }
          user.teams = teamsArray
          callback()
        })
      }, cb)
    }],

    fetchSuperVisor: ['fetchTeamDetails', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        teamsService.findAll({ $or: [{ indexerArray: user._id }] }, { superVisorId: 1, teamName: 1 }, {}, (err, res) => {
          if (err) {
            return callback(err)
          }
          // console.log("team res", res, user._id)
          const arr = []
          for (let i = 0; i < res.length; i++) {
            arr.push(res[i].superVisorId)
            teamsAll[res[i].superVisorId] = res[i].teamName
          }
          user.superVisorIds = arr
          callback()
        })
      }, cb)
    }],
    fetchIndexers: ['fetchTeamDetails', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        teamsService.findOne({ superVisorId: user._id }, { indexerArray: 1 }, {}, (err, res) => {
          if (err) {
            return callback(err)
          }
          if (res) {
            user.indexerArray = res.indexerArray || []
          } else {
            user.indexerArray = []
          }
          callback()
        })
      }, cb)
    }],
    fetchUserDetails: ['fetchSuperVisor', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        const criteria = {
          _id: { $in: user.superVisorIds }
        }
        userService.findAll(criteria, { email: 1 }, { lean: true }, (err, response) => {
          if (err) {
            return callback(err);
          }
          const resArr = []
          for (const each of response) {
            each.teamName = teamsAll[each._id]
            each.teamId = allCusotmers[each.teamName]
            resArr.push({ ...each })
          }
          user.superVisorIds = resArr
          // console.log("FINALARR-->", response)
          return callback();
        });
      }, cb)
    }],
    fetchIndexerDetails: ['fetchIndexers', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        const criteria = {
          _id: { $in: user.indexerArray }
        }
        userService.findAll(criteria, { email: 1 }, { lean: true }, (err, response) => {
          if (err) {
            return callback(err);
          }
          const resArr = []
          for (const each of response) {
            resArr.push({ ...each })
          }
          user.indexerArray = resArr
          // console.log("FINALARR-->", response)
          return callback();
        });
      }, cb)
    }]
  }, (err, res) => {
    if (err) {
      hcb(err)
    } else {
      hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        userList,
        totalCount: res.getTotalUsersCount,
      })
    }
  })
};
const getOwnDetails = ({ id, tenantId }, payload, hcb) => {
  // console.log("payload", payload)
  // const totalCount = 0
  // let startIndex = null
  // if (payload.pageNo) {
  //     startIndex = ((payload.pageNo) - 1) * payload.limit
  //     // endIndex = payload.pageNo * payload.limit
  // }
  const criteria = {
    isDeleted: false,
    tenantId: createMongooseId(tenantId),
  }
  let userList = null
  criteria['_id'] = createMongooseId(id)
  // if (payload.email) {
  //   // eslint-disable-next-line no-useless-escape
  //   const regEmail = payload.email.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  //   criteria['email'] = { $regex: regEmail, '$options': 'i' };
  // }
  // if (payload.roleId) {
  //   criteria['roleId'] = payload.roleId;
  // }
  // if (`isDefault` in payload) {
  //   criteria['isDefault'] = payload.isDefault;
  // }

  // console.log("criteria getUser:::::", criteria)
  const teamsAll = {}
  const allCusotmers = {}
  const customersForTeam = {}
  // let roleName = null;
  auto({
    // "getTotalUsersCount": (cb) => {
    //   userService.count(criteria, cb)
    // },
    getUsers: (cb) => {
      userService.findAll(criteria, { firstName: 1, lastName: 1, email: 1, createdAt: 1, updatedAt: 1, roleId: 1, isDefault: 1 }, { lean: true, sort: { createdAt: -1 } }, (err, response) => {
        if (err) {
          cb(err);
        }
        // totalCount = response.length;
        // console.log("response getUser:::", response)
        userList = response
        return cb(null, {
          ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          userList,
        });
      });
    },
    getTeamIds: (cb) => {
      customersService.findAll({}, { teamName: 1, _id: 1, customersArray: 1 }, { lean: true, sort: { createdAt: -1 } }, (err, response) => {
        if (err) {
          cb(err);
        }
        for (const each of response) {
          allCusotmers[each.teamName] = each._id
          if (customersForTeam.hasOwnProperty(each.teamName)) {
            customersForTeam[each.teamName] = customersForTeam[each.teamName].concat(each.customersArray)
          } else {
            customersForTeam[each.teamName] = each.customersArray || []
          }
        }
        // console.log("response--->", response);
        return cb();
      });
    },
    fetchTeamDetails: ['getUsers', 'getTeamIds', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        teamsService.findAll({ $or: [{ superVisorId: user._id }, { indexerArray: user._id }] }, { teamName: 1 }, {}, (err, res) => {
          if (err) {
            return callback(err)
          }
          // console.log("team res", res, user._id)
          const allTeams = {}
          for (const each of res) {
            if (!(each.teamName in allTeams)) {
              allTeams[each.teamName] = {
                _id: allCusotmers[each.teamName],
                teamName: each.teamName,
                customersArray: customersForTeam[each.teamName]
              }
            }
          }
          // for (const each of allTeams) {
          //   allTeams[each.teamName] =
          // }
          const teamsArray = []
          for (const each in allTeams) {
            teamsArray.push(allTeams[each])
          }
          user.teams = teamsArray
          callback()
        })
      }, cb)
    }],

    fetchSuperVisor: ['fetchTeamDetails', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        teamsService.findAll({ $or: [{ indexerArray: user._id }] }, { superVisorId: 1, teamName: 1 }, {}, (err, res) => {
          if (err) {
            return callback(err)
          }
          // console.log("team res", res, user._id)
          const arr = []
          for (let i = 0; i < res.length; i++) {
            arr.push(res[i].superVisorId)
            teamsAll[res[i].superVisorId] = res[i].teamName
          }
          user.superVisorIds = arr
          callback()
        })
      }, cb)
    }],
    fetchIndexers: ['fetchTeamDetails', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        teamsService.findOne({ superVisorId: user._id }, { indexerArray: 1 }, {}, (err, res) => {
          if (err) {
            return callback(err)
          }
          if (res) {
            user.indexerArray = res.indexerArray || []
          } else {
            user.indexerArray = []
          }
          callback()
        })
      }, cb)
    }],
    fetchUserDetails: ['fetchSuperVisor', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        const criteria = {
          _id: { $in: user.superVisorIds }
        }
        userService.findAll(criteria, { email: 1 }, { lean: true }, (err, response) => {
          if (err) {
            return callback(err);
          }
          const resArr = []
          for (const each of response) {
            each.teamName = teamsAll[each._id]
            each.teamId = allCusotmers[each.teamName]
            resArr.push({ ...each })
          }
          user.superVisorIds = resArr
          // console.log("FINALARR-->", response)
          return callback();
        });
      }, cb)
    }],
    fetchIndexerDetails: ['fetchIndexers', (res, cb) => {
      eachLimit(userList, 5, (user, callback) => {
        const criteria = {
          _id: { $in: user.indexerArray }
        }
        userService.findAll(criteria, { email: 1 }, { lean: true }, (err, response) => {
          if (err) {
            return callback(err);
          }
          const resArr = []
          for (const each of response) {
            resArr.push({ ...each })
          }
          user.indexerArray = resArr
          // console.log("FINALARR-->", response)
          return callback();
        });
      }, cb)
    }]
  }, (err) => {
    if (err) {
      hcb(err)
    } else {
      hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        userList
      })
    }
  })
};
/**
 * users update
 * @param {Object} userInfo
 * @param {Object} params
 * @param {Object} payload
 * @returns
 */
const usersUpdate = ({ id, tenantId }, { id: recordId }, payload, hcb) => {
  // console.log("RECORD ID--->", recordId)
  if (!(recordId)) {
    return hcb(HTTP_ERROR_MESSAGES.BAD_REQUEST);
  }
  // console.log("payload --->", payload)
  let userInfo = null;
  // let role = null
  let data = null
  let defaultDetails = []
  auto({
    isEmailExist: (cb) => {
      if (payload.email) {
        userService.findOne(
          { _id: { $ne: recordId }, email: payload.email },
          {}, {}, null,
          (err, response) => {
            if (err) {
              return cb(err);
            }
            if (response) {
              return cb(HTTP_ERROR_MESSAGES.EMAIL_ALREADY_EXIST)
            }
            cb();
          },
        );
      } else {
        cb()
      }
    },
    hashPassword: ['isEmailExist', (res, cb) => {
      if (payload.password) {
        hashPassword(payload.password).then((hash) => cb(null, hash))
      } else {
        cb()
      }
    }],
    updateUserDetails: ['hashPassword', (res, cb) => {
      // if (payload.password) {
      const dataToSet = {
        ...payload,
      };
      if (payload.password) {
        dataToSet.password = res.hashPassword
      }
      // console.log("dataToSet---->", dataToSet);
      dataToSet.updatedBy = id;
      userService.update(
        { _id: recordId }, { $set: dataToSet }, { new: true, lean: true }, (err, response) => {
          if (err) {
            return cb(err);
          }
          userInfo = response
          // console.log("userInfo-->", userInfo);
          cb(null, response);
        },
      );
    }],
    checkRole: ['updateUserDetails', (res, cb) => {
      if ((payload.superVisorIds && payload.superVisorIds) || (payload.teamName || payload.tenantId)) {
        const criteria = { _id: userInfo.roleId };
        roleService.findOne(criteria, {}, {}, (err, result) => {
          if (err) {
            return cb(err);
          }
          if (result) {
            if (result.role === 'ENTERPRISE_ADMIN') {
              return cb(HTTP_ERROR_MESSAGES.FORBIDDEN)
            }
            data = result;
          } else {
            return cb(HTTP_ERROR_MESSAGES.ROLE_ID_NOT_FOUND)
          }
          cb()
        });
      } else {
        cb()
      }
    }],
    'checkUserUpdate': ['checkRole', (res, cb) => {
      // In this we are gonna update the superVisor or Indexer in the team Schema
      if ((payload.superVisorIds && payload.superVisorIds) || (payload.teamName || payload.tenantId)) {
        if (data.role === 'ENTERPRISE_INDEXER') {
          // need to update the Indexer in the team Schema
          // console.log("INN")
            auto({
              verifySuperVisorIds: (ecb) => {
                if (payload.superVisorIds && payload.superVisorIds.length) {
                  // if the superVisor is coming then check or else assign the Indexers to default superVisor
                  const criteria = { superVisorId: { $in: payload.superVisorIds.map(e => createMongooseId(e)) } }
                  teamsService.findAll(criteria, {}, {}, (err, response) => {
                    if (err) {
                      console.log(err)
                      ecb(err)
                    }
                    if (response && response.length) {
                      // console.log("response FROM Get teams-->", response)
                      if (response.length !== payload.superVisorIds.length) {
                        return ecb(HTTP_ERROR_MESSAGES.BAD_REQUEST)
                      }
                    }
                    ecb()
                  })
                } else {
                  userService.findAll({ firstName: 'DEFAULT', tenantId }, { _id: 1 }, {}, (err, response) => {
                    if (err) {
                      return ecb(err);
                    }
                    // console.log("DEFAULT RESPONSE ---->", response)
                    if (response) {
                      defaultDetails = response[0] // this will gte us the indexer Array of the supervisor
                      // console.log("defaultDetails-->", response[0])
                      // console.log("INN 2-> verifySuperVisorIds")
                    }
                    ecb()
                  });
                }
              },
              removeExistingIndexers: ['verifySuperVisorIds', (res, ecb) => {
                const criteria = { indexerArray: { $in: [createMongooseId(recordId)] } }
                const dataToSet = { $pullAll: { indexerArray: [createMongooseId(recordId)] }, updatedBy: id }
                // console.log("CC----->", JSON.stringify(criteria), JSON.stringify(dataToSet))
                teamsService.updateAll(criteria, dataToSet, {}, (err) => {
                  if (err) {
                    return ecb(err);
                  }
                  // console.log("response for remove Indexer in update User-->", response);
                  ecb();
                })
              }],
              addIndexersUnderNewSuperVisors: ['removeExistingIndexers', (res, ecb) => {
                let criteria = {}
                if (payload.superVisorIds && payload.superVisorIds.length) {
                  // console.log("Inn Payload Super Visors", payload)
                  criteria = { superVisorId: { $in: payload.superVisorIds.map(e => createMongooseId(e)) } }
                } else {
                  // console.log("Inn DEFAULT  Super Visors")
                  criteria = { superVisorId: { $in: [defaultDetails._id] } }
                }
                const dataToSet = { $addToSet: { indexerArray: createMongooseId(recordId) }, updatedBy: id }
                // console.log("dataToSet-->", dataToSet, criteria)
                teamsService.updateAll(criteria, dataToSet, { new: true }, (err, response) => {
                  if (err) {
                    return ecb(err);
                  }
                  // console.log("response for update User-->", response);
                  return ecb(null, response);
                })
              }]
            }, cb)
        } else if (data.role === 'ENTERPRISE_SUPERVISOR') {
          // THIS IS FOR SUPERVISORS
          // let teamExists = false
          auto({
            checkIfTeamExists: (ecb) => {
              if (!(payload.teamName)) {
                return ecb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: 'Team Name is Required' }) // TODO WHAT KIND OF ERR
              }
              teamsService.findOne({ teamName: payload.teamName, tenantId }, {}, {}, (err, response) => {
                if (err) {
                  console.log("ERROR", err)
                  return ecb(err);
                }
                if (response) {
                  // teamExists = true
                }
                ecb();
              });
            },
            updateSupervisorTeam: ['checkIfTeamExists', (res, ecb) => {
              if (!(payload.teamName)) {
                return ecb()
              }
              // if (!(teamExists)) {
              //   const response = HTTP_ERROR_MESSAGES.TEAM_DOES_NOT_EXIST

              //   }
              //   return ecb(null, response);
              // }
              const dataToSet = { teamName: payload.teamName, updatedBy: id }
              teamsService.updateAll({ superVisorId: recordId }, dataToSet, { new: true }, (err, response) => {
                if (err) {
                  return ecb(err);
                }
                // console.log("response for update User-->", response);
                return ecb(null, response);
              })
            }],
            updateCustomerTeam: ['checkIfTeamExists', (res, cb) => {
              if (payload.teamName) {
                customersService.findOne({ teamName: payload.teamName, tenantId }, {}, { lean: true }, (err, response) => {
                  if (response) {
                    return cb()
                  }
                  const dataToSet = {
                    teamName: payload.teamName,
                    tenantId
                  }
                  customersService.create(dataToSet, (err, res) => {
                    if (err) {
                      console.log("customer error", err)
                      cb(err)
                    } else {
                      // console.log("customers res:::", res)
                      cb(null, res)
                    }
                  })
                })
              } else {
                cb()
              }
            }]
          }, cb)
        } else {
          cb()
        }
      } else {
        cb()
      }
    }],
    sendUpdatedUserDetails: ["checkUserUpdate", (res, cb) => {
      if ((payload.superVisorIds && payload.superVisorIds) || (payload.teamName || payload.tenantId)) {
        teamDetails(userInfo._id, { superVisorId: 1, teamName: 1 }, (err, teams) => {
          userInfo.teams = teams || [];
          const superVisorIds = userInfo.teams.map(t => t.superVisorId);
          details(superVisorIds, null, (err, superVisors) => {
            userInfo.superVisorIds = superVisors || [];
            cb()
          })
        })
      } else {
        cb()
      }
    }]

  }, (err) => {
    if (err) {
      return hcb(err);
    }
    // console.log(results)
    // if ()
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
    return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: userInfo });
  });
};

/**
 * users delete
 * @param {Object} userInfo
 * @param {Object} params
 * @returns
 */
const usersDelete = ({ id, tenantId }, payload, hcb) => {
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
    email: null
  };
  if (!(payload.id)) {
    return hcb(HTTP_ERROR_MESSAGES.BAD_REQUEST);
  }
  let userInfo = null;
  let data = null
  let defaultDetails = []
  auto({
    getDetailsOfUsers: (cb) => {
      userService.findAll({ _id: payload.id }, {}, { new: true }, (err, response) => {
        if (err) {
          return cb(err);
        }
        // console.log(response)
        if (!(response)) {
          return cb(HTTP_ERROR_MESSAGES.NOT_FOUND)
        }
        // userInfo = response[0] && response[0].roleId
        userInfo = response[0]
        const temp = response[0].email.split("@")
        // console.log("splitted email: ", temp)
        dataToSet.email = `${temp[0]}__${generateAlphaNumericString()}@${temp[1]}`
        dataToSet.updatedBy = id
        // console.log("set email: ", dataToSet.email)
        cb();
      });
    },
    getRole: ['getDetailsOfUsers', (res, cb) => {
      const criteria = { _id: userInfo.roleId };
      roleService.findOne(criteria, {}, {}, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (result) {
          if (result.role === 'ENTERPRISE_ADMIN') {
            return cb(HTTP_ERROR_MESSAGES.FORBIDDEN)
          }
          data = result;
        } else {
          return cb(HTTP_ERROR_MESSAGES.ROLE_ID_NOT_FOUND)
        }
        cb()
      });
    }],
    checkAndUpdateUser: ['getRole', (res, cb) => {
      if (data) {
        if (data.role === 'ENTERPRISE_INDEXER') {
          auto({
            removeIndexerFromUsers: (ecb) => {
              userService.update({ _id: payload.id }, { $set: dataToSet }, { new: true }, (err) => {
                if (err) {
                  return ecb(err);
                }
                // console.log(response)
                return ecb();
              });
            },
            removeTheIndexerFromSuperVisor: ['removeIndexerFromUsers', (res, ecb) => {
              const criteria = { indexerArray: { $in: [createMongooseId(payload.id)] } }
              const setData = { $pullAll: { indexerArray: [createMongooseId(payload.id)] }, updatedBy: id }
              // { $pullAll: { indexerArray: [createMongooseId(recordId)] }
              teamsService.updateAll(criteria, setData, { new: true }, (err) => {
                if (err) {
                  return ecb(err);
                }
                // console.log("response for remove Indexer in delete  User-->", response);
                // ecb();
                return ecb()
              })
            }]
          }, (err, results) => {
            if (err) {
              return cb(err);
            }
            // console.log(results)
            // if ()
            return cb(null, results);
          })
        } else {
          // Delete SuperVisor then assign it to a default superVisor or assign to the sent supervisor
          let details = {}
          let userDetails = []
          auto({
            getUserDetailsFromTeam: (ecb) => {
              teamsService.findOne({ superVisorId: payload.id }, {}, { lean: true }, (err, response) => {
                if (err) {
                  return ecb(err);
                }
                if (!(response)) {
                  return ecb({
                    ...HTTP_ERROR_MESSAGES.NOT_FOUND,
                    message: 'User Not Found In Any Team',
                  })
                }
                details = response // this will get us the indexer Array of the supervisor
                ecb()
              });
            },
            getUserDetails: (ecb) => {
              userService.findAll({ _id: payload.id }, {}, { lean: true }, (err, response) => {
                if (err) {
                  return ecb(err);
                }
                if (!(response)) {
                  return ecb(HTTP_ERROR_MESSAGES.NOT_FOUND)
                }
                userDetails = response[0] // this will get us the indexer Array of the supervisor
                ecb()
              });
            },
            deleteSuperVisor: ['getUserDetails', 'getUserDetailsFromTeam', (res, ecb) => {
              // console.log("userDetails--->", userDetails)
              const temp = userDetails.email.split("@")
              // console.log("splitted email: ", temp)
              dataToSet.email = `${temp[0]}__${generateAlphaNumericString()}@${temp[1]}`
              dataToSet.updatedBy = id
              // console.log("set email: ", dataToSet.email)
              // console.log(details)
              userService.update({ _id: payload.id }, dataToSet, (err) => {
                if (err) {
                  return ecb(err);
                }
                // if (response) {
                //   // details = response
                //   // console.log(response)
                // }
                ecb()
              });
            }],
            updateDeletedSuperVisorIndexers: ['deleteSuperVisor', (res, ecb) => {
              // console.log("INN updateDeletedSuperVisorIndexers")
              const dataToSet = {
                indexerArray: [],
                updatedBy: id
              }
              teamsService.update({ superVisorId: payload.id }, { $set: dataToSet }, { new: true }, (err) => {
                if (err) {
                  return ecb(err);
                }
                // console.log(res)
                // console.log("OUT updateDeletedSuperVisorIndexers")
                ecb();
              })
            }],
            updateIndexersSupervisor: ['updateDeletedSuperVisorIndexers', (res, ecb) => {
              if (details && details.indexerArray && details.indexerArray.length) {
                // console.log("INN updateIndexersSupervisor")
                const setData = { $addToSet: { indexerArray: details.indexerArray }, updatedBy: id }
                auto({
                  getDefaultSuperVisor: (icb) => {
                    if (!(payload.newSuperVisorId)) {
                      userService.findAll({ firstName: 'DEFAULT', tenantId }, {}, {}, (err, response) => {
                        if (err) {
                          return icb(err);
                        }
                        // console.log("DEFAULT RESPONSE ---->", response)
                        if (response) {
                          defaultDetails = response[0] // this will get us the indexer Array of the supervisor
                          // console.log(response)
                          // console.log("INN 2-> updateIndexersSupervisor")
                        }
                        icb()
                      });
                    } else {
                      icb()
                    }
                  },
                  updateSupervisor: ['getDefaultSuperVisor', (res, icb) => {
                    // console.log("INN updateSupervisor")
                    let newSuperVisorId = null;
                    if (payload.newSuperVisorId) {
                      newSuperVisorId = payload.newSuperVisorId
                    } else {
                      newSuperVisorId = defaultDetails._id
                    }
                    // const setData = {
                    //   'indexArray':
                    // }
                    teamsService.update({ superVisorId: newSuperVisorId }, setData, { new: true }, (err) => {
                      if (err) {
                        return icb(err);
                      }
                      // console.log("updated SuperVisor Indexer Arr", res)
                      return icb();
                    });
                  }]
                }, (err, results) => {
                  if (err) {
                    return ecb(err);
                  }
                  // console.log(results)
                  // if ()
                  return ecb(null, results.updateSupervisor);
                })
              } else {
                return ecb()
              }
            }]
          }, (err, results) => {
            if (err) {
              return cb(err);
            }
            // console.log(results)
            // if ()
            return cb(null, results.updateIndexersSupervisor);
          })
        }
      } else {
        cb()
      }
    }]

  }, (err) => {
    if (err) {
      return hcb(err);
    }
    // console.log(results)
    // if ()
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
    return hcb(null, HTTP_SUCCESS_MESSAGES.DELETE_USER);
  })
};

module.exports = {
  createUser,
  getUser,
  usersUpdate,
  usersDelete,
  getOwnDetails
};
