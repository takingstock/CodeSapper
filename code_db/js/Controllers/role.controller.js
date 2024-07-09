const config = require('config');
const { roleService } = require('../Services');

const ROLES_LIST = config.get('ROLES.LIST');
const ROLES_SUPER_ADMIN = ROLES_LIST.find((role) => role === 'SUPER_ADMIN');
const ROLES_ENTERPRISE_ADMIN = ROLES_LIST.find((role) => role === 'ENTERPRISE_ADMIN');
// const ROLES_ENTERPRISE_USER = ROLES_LIST.find((role) => role === 'ENTERPRISE_USER');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
/**
 * roles list
 * @param {Oject} userInfo
 * @returns
 */
const rolesList = ({ role }, cb) => {
  let criteria = {};
  if (role === ROLES_SUPER_ADMIN) {
    criteria = {};
  } else if (role === ROLES_ENTERPRISE_ADMIN) {
    criteria = {
          role: {
            $nin: [ROLES_SUPER_ADMIN],
          },
    };
  }
  roleService.findAll(criteria, { role: 1 }, {}, (err, result) => {
    if (err) {
      return cb(err);
    }
    const data = result
    return cb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
       data });
  });
};

/**
 * fetch role
 ** @param {Object} userInfo
 * @param {Object} params
 * @returns
 */
const rolesDetail = ({ role }, { id: roleId }, cb) => {
  let criteria = { _id: roleId };
  const projection = { role: 1 };
  // if (role === ROLES_SUPER_ADMIN) {
  //   criteria = { _id: roleId }
  // } else
  if (role === ROLES_ENTERPRISE_ADMIN) {
    criteria = {
          role: {
            $nin: [ROLES_SUPER_ADMIN],
          },
          _id: roleId,
    };
  }
  roleService.findOne(criteria, projection, {}, (err, result) => {
    if (err) {
      return cb(err);
    }
    const data = result;
    return cb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
       data
    });
  });
};

// if Super Admin == All Roles
// ENTERPRISE_ADMIN = ALL ROLES EXCEPT ENTERPRISE ADMIN AND SUPER ADMIN
module.exports = {
  rolesList,
  rolesDetail,
};
