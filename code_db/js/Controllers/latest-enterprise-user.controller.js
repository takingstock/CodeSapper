const config = require('config');
// const async = require('async');
const { auto } = require('async');
const { userService, roleService } = require('../Services');

const {
  hashPasswordCb,
  createMongooseId,
  generateAlphaNumericString,
} = require('../Utils/universal-functions.util');
const { clearCacheUserTeams } = require("../cache/commonCache")

const TEAM = require('../Models/latest-team.model')

const { EMIT_EVENT } = require('../Utils/data-emitter.util');

const APP_EVENTS = config.get('APP_EVENTS');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');

const fetchUserList = ({ id, tenantId }, queryParam, hcb) => {
  const { sortBy = 'createdAt', orderBy = 'ASC', offset = 0, limit = 20 } = queryParam
  const sortObj = {
    [`${sortBy}`]: orderBy === 'DESC' ? -1 : 1,
  };
  const criteria = {
    isDeleted: false,
    tenantId: createMongooseId(tenantId),
    _id: { $nin: [createMongooseId(id)] }
  }
  if (queryParam.email) {
    // eslint-disable-next-line no-useless-escape
    const regEmail = queryParam.email.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    criteria['email'] = { $regex: regEmail, '$options': 'i' };
  }
  if (queryParam.roleId) {
    criteria['roleId'] = queryParam.roleId;
  }
  auto({
    totalCount: (cb) => {
      userService.count(criteria, cb)
    },
    Users: (cb) => {
      const projection = { firstName: 1, lastName: 1, email: 1, createdAt: 1, updatedAt: 1, roleId: 1, isDefault: 1 }
      userService.findAll(criteria, projection, { lean: true, sort: sortObj, skip: offset, limit },
        (err, users) => {
          if (err) {
            return cb(err);
          }
          return cb(null, users);
        });
    }
  }, (err, { Users, totalCount }) => {
    if (err) {
      hcb(err)
    } else {
      hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: Users,
        totalCount,
      })
    }
  })
};

/**
 * Get team details section
 */
const fetchUserDetail = (user, param, callback) => {
  auto({
    User: (cb) => {
      const projection = { firstName: 1, lastName: 1, email: 1, createdAt: 1, updatedAt: 1, roleId: 1, isDefault: 1 }
      userService.findOne({ _id: param.userId }, projection, cb);
    },
  }, (e, { User }) => {
    if (e) {
      return callback(e)
    }
    callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: User })
  })
}

const createNewUser = ({ id, tenantId }, payload, callback) => {
  payload.email = payload.email.toLowerCase()
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
    getRole: (cb) => {
      const criteria = { _id: payload.roleId };
      roleService.findOne(criteria, {}, {}, (err, role) => {
        if (err) {
          return cb(err);
        }
        if (!role) {
          return cb(HTTP_ERROR_MESSAGES.ROLE_ID_NOT_FOUND)
        }
        cb()
      });
    },
    hash: (cb) => hashPasswordCb(payload.password, 10, cb),
    createUser: ['isEmailExist', 'hash', 'getRole', ({ hash }, cb) => {
      const dataToAdd = {
        ...payload,
        isDeleted: false,
        tenantId,
        status: true,
        password: hash,
        createdBy: id,
      };
      userService.create(dataToAdd, cb);
    }]
  }, (err) => {
    if (err) {
      return callback(err);
    }
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
    return callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT);
  });
};
const updateTeam = (data, callback) => {
  if (!data) {
    console.log("NO data found to update team")
    return callback()
  }
  const userId = createMongooseId(data.userId)
  auto({
    Teams: (cb) => {
      let pullUserData = {};
      const indexers = { userId }
      const supervisors = { userId }
      if (data.NEW_ROLE === "ENTERPRISE_INDEXER") {
        pullUserData = {
          ...pullUserData,
          supervisors
        }
      } else { // remove from indexers and supervisors for admin and supvisor
        pullUserData = {
          ...pullUserData,
          supervisors,
          indexers
        }
      }
      console.log("REMOVE FROM TEAMS WHERE pull data is", pullUserData)
      TEAM.updateMany({}, { $pull: pullUserData }, ((e, r) => {
        clearCacheUserTeams(data.userId)
        cb(e, r)
      }))
    }
  }, callback)
}
const updateUser = ({ id, tenantId }, params, payload, callback) => {
  const dataToSet = {
    ...payload,
    updatedBy: id,
  };
  let NEW_ROLE = null;
  auto({
    isEmailExist: (cb) => {
      if (payload.email) {
        dataToSet.email = payload.email.toLowerCase()
        userService.findOne(
          { _id: { $nin: [createMongooseId(params.userId)] }, email: dataToSet.email, isDeleted: false },
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
    getRole: (cb) => {
      if (!payload.roleId) {
        return cb()
      }
      const criteria = { _id: payload.roleId };
      roleService.findOne(criteria, {}, {}, (err, role) => {
        if (err) {
          return cb(err);
        }
        if (!role) {
          return cb(HTTP_ERROR_MESSAGES.ROLE_ID_NOT_FOUND)
        }
        cb(null, role)
      });
    },
    hash: (cb) => {
      if (!dataToSet.password) {
        return cb()
      }
      hashPasswordCb(dataToSet.password, 10, (e, hash) => {
        if (e) {
          return cb(e)
        }
        dataToSet.password = hash
        cb(null, hash)
      })
    },
    User: (cb) => {
      userService.findOne({ _id: params.userId }, { _id: 1, roleId: 1 }, null, null, cb)
    },
    validation: ['hash', 'getRole', 'User', ({ getRole, User }, cb) => {
      if (!User) {
        return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "User not valid" })
      }
      let userType = "Supervisor"
      let criteria
      console.log("User.roleId !== getRole.roleId.toString()::", User.roleId, getRole.roleId)
      if (getRole && getRole._id && User && (User.roleId !== getRole._id.toString())) {
        NEW_ROLE = getRole.role // role changed
        if (NEW_ROLE !== "ENTERPRISE_SUPERVISOR") {
          criteria = {
            "supervisors.userId": params.userId,
            "indexers.reviewPercent": { $gt: 0 },
            "supervisors.1": { $exists: false } // alone supervisor in team where supervisor qc is required
          }
        }
        if (NEW_ROLE === "ENTERPRISE_SUPERVISOR") {
          userType = "Indexer"
          criteria = {
            "indexers.userId": params.userId,
            "customers.0": { $exists: true },
            "indexers.1": { $exists: false } // alone indexers in team where indexing is required
          }
        }
      }
      if (!criteria) {
        return cb()
      }
      TEAM.findOne(criteria, (e, team) => {
        if (e) {
          return cb(e)
        }
        if (team) {
          return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: `Single ${userType} in team '${team.teamName}'` });
        }
        cb()
      })
    }],
    updateTeam: ['validation', (_, cb) => {
      if (!NEW_ROLE) {
        return cb()
      }
      const data = {
        userId: params.userId,
        NEW_ROLE
      }
      updateTeam(data, cb)
    }],
    updateUser: ['validation', (_, cb) => {
      userService.update({ _id: params.userId }, { $set: dataToSet }, null, cb);
    }]
  }, (err) => {
    if (err) {
      return callback(err);
    }
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
    return callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT);
  });
};
const deleteUser = ({ id, tenantId }, params, hcb) => {
  const dataToSet = {
    isDeleted: true,
    email: null,
    deletedBy: id,
    updatedBy: id,
  };

  auto({
    User: (cb) => {
      userService.findOne(
        { _id: params.userId },
        { email: 1 },
        null,
        [{ path: "roleId", fields: "role" }], cb
      );
    },
    validation: ['User', ({ User }, cb) => {
      console.log("DELETE USER>>>>>>>>: ", User)
      if (!User) {
        return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "User not valid" })
      }
      let criteria
      let userType = "Supervisor"
      if (User.roleId && User.roleId.role) {
        if (User.roleId.role === "ENTERPRISE_SUPERVISOR") {
          criteria = {
            "supervisors.userId": params.userId,
            "indexers.reviewPercent": { $gt: 0 },
            "supervisors.1": { $exists: false } // alone supervisor in team where supervisor qc is required
          }
        }
        if (User.roleId.role === "ENTERPRISE_INDEXER") {
          userType = "Indexer"
          criteria = {
            "indexers.userId": params.userId,
            "customers.0": { $exists: true },
            "indexers.1": { $exists: false } // alone indexers in team where indexing is required
          }
        }
      }
      if (!criteria) {
        return cb()
      }
      TEAM.findOne(criteria, (e, team) => {
        if (e) {
          return cb(e)
        }
        if (team) {
          return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: `Sinlge ${userType} in team '${team.teamName}'` });
        }
        cb()
      })
    }],
    deleteUser: ['validation', ({ User }, cb) => {
      const temp = User.email.split("@")
      dataToSet.email = `${temp[0]}__${generateAlphaNumericString()}@${temp[1]}`
      userService.update({ _id: params.userId }, dataToSet, (err) => {
        if (err) {
          return cb(err);
        }
        cb()
      });
    }],
    removeFromTeam: ['validation', (_, cb) => {
      updateTeam({ userId: params.userId }, cb)
    }]
  }, (err) => {
    if (err) {
      return hcb(err);
    }
    EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
    return hcb(null, HTTP_SUCCESS_MESSAGES.DELETE_USER);
  })
};
const userDetails = (user, hcb) => {
  auto({
    User: (cb) => {
      userService.findAll(
        { _id: user.id },
        { firstName: 1, lastName: 1, email: 1, createdAt: 1, updatedAt: 1, roleId: 1, isDefault: 1 },
        cb
      );
    },
    teams: (cb) => {
      const criteria = {
        $or: [{
          "supervisors.userId": user.id
        },
        {
          "indexers.userId": user.id,
        }]
      }
      TEAM.find(criteria, { teamName: 1, customers: 1 }, cb)
    }
  }, (err, { teams, User }) => {
    if (err) {
      console.log("ERROR: ", err)
      hcb(err)
    } else {
      hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: { user: User, teams }
      })
    }
  })
};
module.exports = {
  createNewUser,
  fetchUserList,
  updateUser,
  deleteUser,
  fetchUserDetail,
  userDetails
};
