const config = require('config');
// const async = require("async");
const { auto, eachSeries } = require('async');
const { hashPassword } = require('./universal-functions.util');
const { TEAMS } = require("../Mock/users.mock")
const { teamsService, roleService, userService, tenantService, customersService, VendorsService } = require('../Services');

const ENTERPRISE_SUPERVISOR = config.get('ROLES.SUPERVISOR')
const ENTERPRISE_INDEXER = config.get('ROLES.INDEXER')
const defaultTeam = {
  teamName: "Default Team"
}

const bootstrapDefaultTeam = async (newUser, team) => new Promise((resolve) => {
  const teamDetails = { teamName: team.teamName }
  // console.log("teamDetails", teamDetails)
  teamsService.count({ superVisorId: newUser._id }, (err, res) => {
    if (err) {
      return resolve(err)
    }
    if (res === 0) {
      teamDetails.tenantId = newUser.tenantId
      teamDetails.superVisorId = newUser._id
      if (team.customers) {
        teamDetails.customersArray = team.customers
      }
      teamsService.create(teamDetails, (err, res) => {
        if (err) {
          return resolve(err)
        }
        return resolve(res)
      })
    } else {
      resolve(true)
    }
  });
});

const createUser = (item, callback) => {
  let tenantId = null
  auto({
    checkUser: (cb) => {
      userService.findOne({ email: item.email }, null, null, null, cb)
    },
    hashPassword: (cb) => hashPassword(item.password).then((hash) => cb(null, hash)),
    getTenantId: (callback) => {
      tenantService.findOne({ name: item.tenant }, { name: 1 }, (err, res) => {
        if (err) {
          callback(err, null)
        }
        tenantId = res._id
        callback()
      });
    },
    User: ['hashPassword', 'getTenantId', ({ checkUser, hashPassword }, cb) => {
      const data = { ...item, tenantId, status: true }
      delete data.teamName
      delete data.customers
      if (!checkUser) {
        data.password = hashPassword
        userService.create(data, cb)
      } else {
        cb(null, checkUser)
      }
      // console.log("creating user::::::::::::::::::", data)
      // userService.update({ email: data.email }, { $set: data }, { new: true, upsert: true }, cb);
    }],
  }, (err, { User }) => {
    if (err) {
      console.log("ERROR WHILE CREATING USER")
    }
    callback(err, User)
  })
}

const addIndexer = (item, callback) => {
  // console.log("WORKING on indexer: ", item)
  auto({
    createIndexer: (cb) => {
      createUser(item, cb);
    },
    supervisors: (cb) => {
      userService.findAll({ email: { $in: item.supervisorEmailIds } }, null, null, cb)
    },
    assignSupervisors: ["createIndexer", "supervisors", ({ supervisors, createIndexer }, cb) => {
      const indexerId = createIndexer && createIndexer._id
      teamsService.update({ superVisorId: { $in: supervisors.map(e => e._id) } }, { $addToSet: { indexerArray: indexerId } }, null, cb)
    }]
  }, (err, result) => {
    callback(err, result.checkUser || result.createUser);
  });
}

const addSupervisor = (item, callback) => {
  // console.log("WORKING ON supervisor:", item)
  auto({
    addSupervisor: (cb) => {
      createUser(item, cb);
    },
    createTeam: ['addSupervisor', ({ addSupervisor }, cb) => {
      bootstrapDefaultTeam(addSupervisor, item).then((res) => {
        console.log("Team Created:::", res)
        cb()
      }).catch((e) => {
        console.log("106>>>>>>>>>", e)
        cb()
      })
    }],
    checkCustomerTeam: ['addSupervisor', ({ addSupervisor }, cb) => {
      customersService.findOne({ teamName: item.teamName, tenantId: addSupervisor.tenantId }, null, null, cb)
    }],
    getAllCustomers: ['checkCustomerTeam', ({ checkCustomerTeam }, cb) => {
      // console.log("checkCustomerteam:::", (checkCustomerTeam && checkCustomerTeam.teamName) || "fasdfasdfa")
      if (checkCustomerTeam) {
        return cb()
      }
      if (item.isDefault) {
        const arr = []
        // console.log("inside getallcustomers")
        VendorsService.findAll({}, { customerId: 1 }, { lean: true }, (err, hooks) => {
          if (err) {
            return cb(err)
          }
          for (let i = 0; i < hooks.length; i++) {
            if (arr.indexOf(hooks[i].customerId) === -1) {
              arr.push(hooks[i].customerId)
            }
          }
          // console.log("arr:::::", arr)
          item.customers = arr
          return cb()
        })
      } else {
        cb()
      }
    }],
    createCustomerTeam: ['getAllCustomers', 'checkCustomerTeam', 'addSupervisor', ({ checkCustomerTeam, addSupervisor }, cb) => {
      if (checkCustomerTeam) {
        return cb()
      }
      // console.log("creatting new customer team", item.teamName)
      const data = {
        teamName: item.teamName,
        customersArray: item.customers,
        tenantId: addSupervisor.tenantId,
        isDefault: item.isDefault || false
      }
      // console.log("")
      customersService.create(data, cb)
    }],
    updateCustomerTeam: ['checkCustomerTeam', ({ checkCustomerTeam }, cb) => {
      if (!checkCustomerTeam || item.teamName === defaultTeam.teamName) {
        return cb()
      }
      const data = {
        customersArray: item.customers,
      }
      // console.log("updating new customer team", item.teamName)
      customersService.update({ teamName: item.teamName }, { $addToSet: data }, null, cb)
    }]
  }, (err, result) => {
    callback(err, result);
  });
}

const bootstrapUsersAndTeams = async (users = []) => new Promise(async (resolve) => {
  const supervisorRole = await roleService.findOne({ role: ENTERPRISE_SUPERVISOR });
  const indexerRole = await roleService.findOne({ role: ENTERPRISE_INDEXER });
  eachSeries(users, (user, ecb) => {
    user.firstName = user.name.split(" ")[0]
    user.lastName = user.name.split(" ")[1]

    if (user.role === "SUPERVISOR") {
      user.roleId = supervisorRole._id
      addSupervisor(user, ecb);
    } else if (user.role === "INDEXER") {
      user.roleId = indexerRole._id
      addIndexer(user, ecb)
    } else {
      ecb("INVALID ROLE")
    }
  }, (err) => {
    console.log("ERRRRRRRRRRR", err);
    resolve(true)
  })
})
const bootstrapTeam = async () => {
  await bootstrapUsersAndTeams(TEAMS)
  return true
}
module.exports = {
  bootstrapTeam,
};
