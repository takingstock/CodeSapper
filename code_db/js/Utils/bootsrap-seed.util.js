const config = require('config');
const { mapSeries, auto } = require('async');
const {
  userService, roleService, tenantService
} = require('../Services');
const { hashPassword } = require('./universal-functions.util');
const CONSOLE = require('./console-log.util');
const { adminUserController, authController } = require('../Controllers');
const { enterpriseArray, userArray, enterpriseAdminArray } = require("../Mock/users.mock")
const { bootstrapTeam } = require('./bootstrap-team.util');

const ROLES_LIST = config.get('ROLES.LIST')
const ENTERPRISE_ADMIN = config.get('ROLES.TENANT')
// default roles
const roles = ROLES_LIST.map(r => ({
  role: r,
  tenantId: null,
}))

// const apiCreationSchema = [
//   {
//     label: 'Name',
//     key: 'name',
//     type: 'text',
//     required: true,
//   },
//   {
//     label: 'Url',
//     key: 'api_url',
//     type: 'text',
//     required: true,
//   },
//   {
//     label: 'Method',
//     key: 'method',
//     type: 'select',
//     values: ['GET', 'POST', 'PUt', 'DELETE'],
//     required: true,
//   },
//   {
//     label: 'Bearer Token',
//     key: 'bearer_token',
//     type: 'text',
//   },
//   {
//     label: 'Sample Response',
//     key: 'sample_response',
//     type: 'text',
//     required: true,
//   },
//   {
//     label: 'Exact Response Path',
//     key: 'json_path',
//     type: 'text',
//     required: true,
//   },
//   {
//     label: 'Error Message',
//     key: 'error_message',
//     type: 'text',
//     required: true,
//   },
//   {
//     label: 'Success Message',
//     key: 'success_message',
//     type: 'text',
//     required: true,
//   },
// ];

/* eslint-disable no-unused-vars */
const seedRoles = async () => {
  await Promise.all(roles.map(async (item) => {
    const role = { ...item };
    await roleService.update({ role: item.role }, { $set: role }, { upsert: true });
  }));
  const newRoles = roles.map((role) => role.role);
  await roleService.deleteMany({ role: { $nin: newRoles } })
};

// create users
/* eslint-disable no-unused-vars */
const seedUsers = async (enterpriseUserArrayList = null) => new Promise(async (resolve) => {
  const enterpriseRole = await roleService.findOne({ role: ENTERPRISE_ADMIN });
  const superAdminUser = await userService.findOne({ email: userArray[0].email });

  mapSeries(enterpriseUserArrayList, (item, mcb) => {
    item.phoneNumber = '9906780524'
    item.firstName = item.name
    item.lastName = item.name
    item.region = 'Asia'
    item.jobTitle = "Developer"
    item.roleId = enterpriseRole._id
    auto({
      // check if user exist
      checkUser: (callback) => {
        userService.findOne({ email: item.email }, (err, response) => {
          if (err) {
            return callback(err, null);
          }
          return callback(null, response);
        });
      },
      // create user
      createUser: ['checkUser', ({ checkUser }, callback) => {
        if (!checkUser) {
          adminUserController.usersCreate(
            { id: superAdminUser._id },
            item,
            (err, response) => {
              if (err) {
                console.log("ERROR createUser", err);
                return callback(null, null);
              }
              return callback(null, response.createuser);
            }
          );
        } else {
          callback(null, null);
        }
      }],
      // update user
      updateUser: ['checkUser', ({ checkUser }, callback) => {
        if (checkUser) {
          userService.update(
            { _id: checkUser._id },
            {
              $set: {
                name: item.name,
                email: item.email
              },
            },
            {},
            (err, response) => {
              if (err) {
                return callback(err);
              }
              return callback(null, response);
            },
          );
        } else {
          callback(null, null);
        }
      }],
      // update tenant
      updateTenant: ['checkUser', ({ checkUser }, callback) => {
        if (checkUser && item.tenant) {
          tenantService.update(
            { _id: checkUser.tenantId },
            { $set: { name: item.tenant } },
            (err, response) => {
              if (err) {
                return callback(err);
              }
              return callback(null, response);
            },
          );
        } else {
          callback(null, true);
        }
      }],
      userWorkflows: ['createUser', 'updateTenant', 'updateUser', ({ checkUser, createUser }, cb) => {
        // let { tenantId, mapping = [] } = mappingFetch
        const tenantId = (checkUser && checkUser.tenantId) || (createUser && createUser.tenantId)
        const userId = (checkUser && checkUser._id) || (createUser && createUser._id)

        if (tenantId && userId) {
          authController.createDefaultWorkflow(userId, tenantId, 'SYSTEM');
          cb(null, true);
        } else {
          cb(null, null);
        }
      }]
    }, (err, result) => {
      mcb(err, result);
    });
  }, (err, result) => {
    if (err) {
      CONSOLE.error(err);
    }
    CONSOLE.success('Demo users & workflows created', err, result);
    resolve(true)
  });
});
const createSuperAdmins = async () => {
  const superAdminRole = await roleService.findOne({ role: roles[0].role });
  await Promise.all(userArray.map(async (item) => {
    const user = { ...item };
    const hash = await hashPassword(item.password);
    user.password = hash;
    user.roleId = superAdminRole;
    await userService.update({ email: item.email }, { $set: user }, { upsert: true });
  }));
}
const seedEnterpiseAdmins = async (users) => new Promise(async (resolve) => {
  const enterpriseRole = await roleService.findOne({ role: ENTERPRISE_ADMIN });

  mapSeries(users, (user, mcb) => {
    auto({
      checkUser: (callback) => {
        userService.findOne({ email: user.email }, (err, response) => {
          if (err) {
            return callback(err);
          }
          return callback(null, response);
        });
      },
      tenant: ['checkUser', (_, cb) => {
        tenantService.findOne({ name: user.tenant }, null, null, cb)
      }],
      tenantUser: ['tenant', ({ tenant }, cb) => {
        userService.findOne({ tenantId: tenant._id }, null, null, null, cb)
      }],
      // create user
      createUser: ['tenantUser', ({ tenantUser, checkUser }, cb) => {
        if (!checkUser) {
          const userData = {
            ...user,
            roleId: enterpriseRole._id,
            tenantId: tenantUser.tenantId,
            phoneNumber: '9906780524',
            firstName: user.name,
            lastName: user.name,
            region: 'Asia',
            jobTitle: "Developer"
          }
          adminUserController.usersCreate(
            { id: tenantUser._id, globalMappingDisabled: true },
            userData,
            (err, response) => {
              if (err) {
                console.log("ERROR createUser", err);
                return cb(null, null);
              }
              console.log(response.message, user.email)
              return cb(null, response.createuser);
            }
          );
        } else {
          cb(null, null);
        }
      }],
      updateUser: ['tenantUser', ({ tenantUser, checkUser }, cb) => {
        if (checkUser) {
          const userData = {
            roleId: enterpriseRole._id,
            tenantId: tenantUser.tenantId
          }
          userService.update({ _id: checkUser._id }, { $set: userData }, null, cb)
        } else {
          cb()
        }
      }],
    }, (err) => {
      if (err) {
        console.log("ERROR seedEnterpiseAdmins :", err)
      }
      mcb()
    })
  }, () => {
    console.log("enterpirse admins created")
    resolve(true)
  })
})
// boostrap seed data
/* eslint-disable no-unused-vars */
const bootstrapSeedData = async (server) => {
  await seedRoles();
  await createSuperAdmins()
  userService.findAll({ email: { $nin: enterpriseArray.map(e => e.email) }, tenantId: { $nin: [null] } }, async (e, r) => {
    console.log("SELECTED USERS: ", r.length, r.concat(enterpriseArray).length)
    await seedUsers(r.concat(enterpriseArray));
    await seedEnterpiseAdmins(enterpriseAdminArray);
    await bootstrapTeam();
  });
  server.log(['seed', 'database', 'success'], 'Seeding DONE!');
  return true;
};

// createSuperAdmins()
module.exports = {
  bootstrapSeedData,
};
