const config = require('config');

const ROLES = config.get('ROLES');
const SUPER_ADMIN = [ROLES.SUPER_ADMIN];
const ENTERPRISE = [...SUPER_ADMIN, ROLES.TENANT]
// old depricated
// const { fetchCustomersFromUserId } = require("../Utils/universal-functions.util")
// new
const { fetchCustomersFromUserId } = require("../Controllers/latest-teams.controller")

const fetchCustomersFromId = {
        type: 'onPostAuth',
        method: async (request, h) => {
          if (!request.route.settings.plugins.customers) { return h.continue }
          const user = request.auth.credentials.user
          if (ENTERPRISE.includes(user.role)) {
            user.customers = null
            return h.continue
          }
            const customers = await fetchCustomersFromUserId(user.id)
            user.customers = customers
            return h.continue
            }
}

module.exports = {
    fetchCustomersFromId
}
