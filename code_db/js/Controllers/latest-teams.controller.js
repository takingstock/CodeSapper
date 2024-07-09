const config = require('config');
const { auto, eachSeries } = require('async');
const TEAM = require('../Models/latest-team.model')
const cachePlugin = require("../cache/customPluginCache")
const cacheTeams = require("../cache/latestTeamCache")
const { clearCacheUserTeams } = require("../cache/commonCache")
const { createXcelFile } = require('../Utils/excel');
const LEGACY_TEAMS = require('../Models/teamsSchema')
const LEGACY_CUSTOMERS = require('../Models/customer.model')

const SERVER_HOST = config.get('HOST');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
/**
 * common functions
 */
const teamExists = (({ tenantId, teamName, teamId }, callback) => {
    auto({
        Team: (cb) => {
            const criteria = { tenantId, teamName }
            if (teamId) {
                criteria._id = { $nin: [teamId] }
            }
            TEAM.findOne(criteria, cb);
        }
    }, (e, { Team }) => {
        if (e) {
            return callback(e)
        }
        callback(null, !!Team)
    })
})
/**
 * common functions
 */
const customerExistsInOtherTeam = (({ tenantId, customers, teamId }, callback) => {
    auto({
        Team: (cb) => {
            const criteria = { tenantId, customers: { $in: customers } }
            if (teamId) {
                criteria._id = { $nin: [teamId] }
            }
            TEAM.findOne(criteria, cb);
        }
    }, (e, { Team }) => {
        if (e) {
            return callback(e)
        }
        callback(null, Team)
    })
})
const removeCache = (keypattern, callback) => {
    clearCacheUserTeams(keypattern)
    callback();
}

/**
 * Validate team
 */
const teamValidation = (team, callback) => {
    // minimum one supervisor for a team with inxing % >0
    let OneSupReq = false
    if (team && team.indexers) {
        team.indexers.forEach(ind => {
            if (ind.reviewPercent > 0) {
                OneSupReq = true
            }
        })
    }
    if (OneSupReq && !(team.supervisors && team.supervisors.length)) {
        return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "At least one supervisor needed for team" })
    }
    return callback()
}
/**
 * add/update team section
 * payload:{
 * customers,
 * reviewPercent,
 * superVisorId,
 * teamName,
 * indexerArray
 * }
 */
const createNewTeam = (user, payload, callback) => {
    auto({
        Team: (cb) => {
            teamExists({ tenantId: user.tenantId, teamName: payload.teamName, }, (e, flag) => {
                if (e) { return cb(e) }
                if (flag) {
                    return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: 'Team Already exists' })
                }
                cb()
            })
        },
        customer: (cb) => {
            if (!(payload.customers && payload.customers.length)) {
                return cb()
            }
            eachSeries(payload.customers, (c, escb) => {
                customerExistsInOtherTeam({ tenantId: user.tenantId, customers: c }, (e, team) => {
                    if (e) { return escb(e) }
                    if (team) {
                        return escb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: `Customer ${c} Already In other team '${team.teamName}'` })
                    }
                    escb()
                })
            }, cb)
        },
        validation: ['Team', 'customer', (_, cb) => {
            teamValidation(payload, cb)
        }],
        expireCahe: ["addTeam", (_, cb) => {
            removeCache("TEAMS", () => {
                removeCache("CP", cb)
            })
        }],
        addTeam: ['validation', (_, cb) => {
            payload.createdBy = user.id
            payload.updatedBy = user.id
            TEAM.create({ ...payload, tenantId: user.tenantId }, cb)
        }],
    }, (e, { addTeam }) => {
        if (e) {
            console.log("CREATE TEAM ERROR", e)
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: addTeam })
    })
}
const updateTeam = (user, param, payload, callback) => {
    auto({
        teamName: (cb) => {
            if (!payload.teamName) {
                return cb()
            }
            if (payload.teamName) {
                teamExists({ tenantId: user.tenantId, teamName: payload.teamName, teamId: param.teamId }, (e, flag) => {
                    if (e) { return cb(e) }
                    if (flag) {
                        return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Team Already exists" })
                    }
                    cb()
                })
            }
        },
        Team: (cb) => {
            TEAM.findOne({ _id: param.teamId }, cb);
        },
        customer: (cb) => {
            if (!(payload.customers && payload.customers.length)) {
                return cb()
            }
            eachSeries(payload.customers, (c, escb) => {
                customerExistsInOtherTeam({ tenantId: user.tenantId, customers: c, teamId: param.teamId }, (e, team) => {
                    if (e) { return escb(e) }
                    if (team) {
                        return escb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: `Customer ${c} Already In other team '${team.teamName}'` })
                    }
                    escb()
                })
            }, cb)
        },
        validation: ['Team', 'customer', 'teamName', ({ Team }, cb) => {
            if (!Team) {
                return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "Invalid team" })
            }
            const team = { ...payload };
            if (!(team.indexers && team.indexers.length)) {
                team.indexers = Team.indexers // add from db to validate indexer sup maping
            }
            if (!(team.supervisors && team.indexers.length)) {
                team.supervisors = Team.supervisors // add from db to validate indexer sup maping
            }
            teamValidation(team, cb)
        }],
        expireCahe: ["updateTeam", (_, cb) => {
            removeCache("TEAMS", () => {
                removeCache("CP", cb)
            })
        }],
        updateTeam: ['validation', (_, cb) => {
            payload.updatedBy = user.id
            TEAM.findOneAndUpdate({ _id: param.teamId }, { $set: payload }, cb);
        }],
    }, (e, { updateTeam }) => {
        if (e) {
            console.log("UPDATE TEAM ERROR", e)
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: updateTeam })
    })
}

/**
 * Get team details section
 */
const getTeamDetails = (user, param, callback) => {
    auto({
        Team: (cb) => {
            const Team = TEAM.findOne({ _id: param.teamId });
            Team.populate('indexers.userId', 'email');
            Team.populate('supervisors.userId', 'email');
            Team.exec(cb)
        },
    }, (e, { Team }) => {
        if (e) {
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: Team })
    })
}
const fetchTeamList = ({ tenantId }, { sortBy = 'createdAt', orderBy = 'ASC', offset = 0, limit = 20, q }, callback) => {
    const sortObj = {
        [`${sortBy}`]: orderBy === 'DESC' ? -1 : 1,
    };
    auto({
        totalCount: (cb) => {
            TEAM.countDocuments({ tenantId }, cb)
        },
        Teams: (cb) => {
            const teams = TEAM.find({ tenantId })
            teams.sort(sortObj)
            teams.skip(offset)
            teams.limit(limit)
            teams.lean().exec(cb)
        }
    }, (e, { Teams, totalCount }) => {
        if (e) {
            return callback(e)
        }
        callback(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: Teams, totalCount })
    })
}

/**
 * delete section
 */
const deleteTeam = (user, { teamId }, callback) => {
    auto({
        Team: (cb) => {
            TEAM.deleteOne({ _id: teamId }, cb);
        },
    }, (e) => {
        if (e) {
            return callback(e)
        }
        callback(null, HTTP_SUCCESS_MESSAGES.DEFAULT)
    })
}
/**
 * fetch Customers Associated with user
 */
const fetchCustomersFromUserId = async (id) => {
    const criteria = {
        $or: [{
            "indexers.userId": id
        },
        {
            "supervisors.userId": id
        }
        ]
    }
    try {
        let customers = await cachePlugin.get(id)
        console.log("CACHE CUSTOMERS:", customers)
        if (customers) {
            console.log("return data from cache", customers);
            return customers
        }
        customers = await TEAM.distinct("customers", criteria);
        const c = await cachePlugin.set(id, customers)
        console.log("set cache", customers, c);
        return customers
    } catch (e) {
        console.log("ERROR fetchCustomersFromUserId:", e)
        return []
    }
}

/**
 * checkReviewPercent for indexer
 * @param {*} doc
 * @param {*} callback
 */
const checkReviewPercent = (doc, callback) => {
    let indexerCacheData = null
    auto({
        cacheReviewPercent: async () => {
            // todo get value from cache
            try {
                const cacheData = await cacheTeams.get(doc.userId)
                console.log("cache key::", `${doc.tenantId}_${doc.externalCustomerId}_${doc.userId}`)
                console.log("cacheData:::", cacheData)
                if (cacheData) {
                    indexerCacheData = cacheData
                    const reviewPercent = indexerCacheData[`${doc.tenantId}_${doc.externalCustomerId}_${doc.userId}`]
                    console.log("review percent cache", reviewPercent);
                    console.log("review percent indexerCacheData", indexerCacheData)
                    if (!reviewPercent && reviewPercent !== 0) {
                        return null
                    }
                    return ({ reviewPercent: +reviewPercent })
                }
                return null
            } catch (e) {
                console.log("CACHE READING ERROR:", e)
                return null
            }
        },
        Team: ['cacheReviewPercent', ({ cacheReviewPercent }, cb) => {
            console.log("cacheReviewPercentcacheReviewPercent:", cacheReviewPercent)
            if (cacheReviewPercent) {
                return cb(null, cacheReviewPercent)
            }
            TEAM.findOne({ tenantId: doc.tenantId, customers: doc.externalCustomerId, "indexers.userId": doc.userId }, cb)
        }],
        reviewPercentage: ['Team', ({ Team, cacheReviewPercent }, cb) => {
            if (cacheReviewPercent) { // skip get value from cache
                return cb(null, cacheReviewPercent)
            }
            let reviewPercent = 100;
            if (Team && Team.indexers) {
                console.log("TEAM DETEcted", Team.indexers)
                Team.indexers.forEach(ind => {
                    if (ind.userId.toString() === doc.userId.toString()) {
                        reviewPercent = ind.reviewPercent
                    }
                })
            }
            const caheKey = `${doc.tenantId}_${doc.externalCustomerId}_${doc.userId}`
            if (!indexerCacheData) {
                indexerCacheData = {}
            }
            indexerCacheData[caheKey] = +reviewPercent
            cb(null, { reviewPercent: +reviewPercent, cacheSet: true })
        }],
        updateCache: ["reviewPercentage", async ({ reviewPercentage }) => {
            // Todo set cache
            if (reviewPercentage.cacheSet) {
                await cacheTeams.set(doc.userId, indexerCacheData)
            }
            return null
        }]
    }, (e, { reviewPercentage }) => {
        if (e) {
            console.log("checkReviewPercent", e)
            return callback(null, null)
        }
        console.log("DEBUG REVIEW PERCENT FOR USER ", doc.userId, reviewPercentage)
        callback(null, reviewPercentage.reviewPercent)
    })
}

const teamsReport = ({ tenantId }, { tenantId: tenantID, sortBy = 'createdAt', orderBy = 'ASC', offset = 0, limit = 20, q }, callback) => {
    const sortObj = {
        [`${sortBy}`]: orderBy === 'DESC' ? -1 : 1,
    };
    tenantId = tenantId || tenantID
    const fileName = `${tenantId}_teams`
    let workbookData = []
    // workbookData = [{ data: [{ A: "dfa", B: "dfa" }, { A: "dfasd", B: "eaef" }], type: "TEAM USERS" }, { data: [], type: "TEAM CUSTOMERS" }]
    auto({
        Teams: (cb) => {
            const Team = TEAM.find({ tenantId })
            Team.populate('indexers.userId', 'email');
            Team.populate('supervisors.userId', 'email');
            Team.sort(sortObj)
            Team.skip(offset)
            Team.limit(limit)
            Team.lean().exec(cb)
        },
        mapData: ['Teams', ({ Teams }, cb) => {
            // workbookData=[{data:[{A:"dfa",B:"dfa"},{A:"dfasd",B:"eaef"}],type},{data:[],type}]
            const headerRow = {}
            // User: "User", UserType: "UserType"
            const userData = {
            }
            const dataCustomerSheet = []
            Teams.forEach(t => {
                headerRow[t.teamName] = t.teamName
                t.indexers.forEach(u => {
                    if (u && u.userId && u.userId.email) {
                        const uid = `${u.userId.email}_indexer`;
                        if (userData[uid]) {
                            userData[uid][t.teamName] = `${u.reviewPercent}`
                        } else {
                            userData[uid] = {
                                User: (u.userId.email),
                                UserType: "INDEXER",
                                [t.teamName]: `${u.reviewPercent}`,
                            }
                        }
                    }
                })
                t.supervisors.forEach(u => {
                    if (u && u.userId && u.userId.email) {
                        const uid = `${u.userId.email}_sup`;
                        if (userData[uid]) {
                            userData[uid][t.teamName] = "Y"
                        } else {
                            userData[uid] = {
                                User: (u.userId.email),
                                UserType: "Supervisor",
                                [t.teamName]: "Y",
                            }
                        }
                    }
                })
                t.customers.forEach(c => {
                    dataCustomerSheet.push({
                        Customer: c,
                        teamName: [t.teamName]
                    })
                })
            })
            const teamSheetHeader = { User: "User", UserType: "UserType", ...headerRow }
            const dataTeamSheet = []
            Object.values(userData).forEach(ut => {
                const row = {}
                Object.keys(teamSheetHeader).forEach((h) => {
                    row[h] = ut[h] || ''
                })
                dataTeamSheet.push(row);
            })
            workbookData.push({
                data: dataTeamSheet, // sheet Data
                type: "TEAM USERS" // sheet name
            })
            workbookData.push({
                data: dataCustomerSheet, // sheetData
                type: "TEAM CUSTOMERS"// sheet name
            })
            return cb()
        }],
        legacyTeams: (cb) => {
            const lt = LEGACY_TEAMS.find({ tenantId })
            lt.populate('indexerArray', 'email');
            lt.populate('superVisorId', 'email');
            lt.lean().exec(cb)
        },
        legacyCustomers: (cb) => {
            const lt = LEGACY_CUSTOMERS.find({ tenantId })
            lt.lean().exec(cb)
        },
        mapLegacyTeamData: ['legacyTeams', ({ legacyTeams, legacyCustomers }, cb) => {
            const userData = {
            }
            const headerRow = {}
            const dataCustomerSheet = []
            const teamReviewPercent = {}
            legacyCustomers.forEach((ct) => {
                teamReviewPercent[ct.teamName] = ct.reviewPercent
                ct.customersArray.forEach((c) => {
                    dataCustomerSheet.push({
                        Customer: c,
                        teamName: ct.teamName,
                        reviewPercent: `${ct.reviewPercent}`
                    })
                })
            })
            legacyTeams.forEach(t => {
                headerRow[t.teamName] = t.teamName
                t.indexerArray.forEach(u => {
                    if (u && u.email) {
                        const uid = `${u.email}_indexer`;
                        if (userData[uid]) {
                            userData[uid][t.teamName] = `${teamReviewPercent[t.teamName]}`
                        } else {
                            userData[uid] = {
                                User: (u.email),
                                UserType: "INDEXER",
                                [t.teamName]: `${teamReviewPercent[t.teamName]}`,
                            }
                        }
                    }
                })
                if (t && t.superVisorId && t.superVisorId.email) {
                    const suid = `${t.superVisorId.email}_sup`;
                    if (userData[suid]) {
                        userData[suid][t.teamName] = "Y"
                    } else {
                        userData[suid] = {
                            User: (t.superVisorId.email),
                            UserType: "Supervisor",
                            [t.teamName]: "Y",
                        }
                    }
                }
            })
            const teamSheetHeader = { User: "User", UserType: "UserType", ...headerRow }
            const dataTeamSheet = []
            Object.values(userData).forEach(ut => {
                const row = {}
                Object.keys(teamSheetHeader).forEach((h) => {
                    row[h] = ut[h] || ''
                })
                dataTeamSheet.push(row);
            })
            workbookData.push({
                data: dataTeamSheet, // sheet Data
                type: "LEGACY TEAM USERS" // sheet name
            })
            workbookData.push({
                data: dataCustomerSheet, // sheetData
                type: "LEGACY TEAM CUSTOMERS"// sheet name
            })
            cb()
        }],
        createXls: ['mapData', 'mapLegacyTeamData', async () => {
            if (workbookData.length === 0) return;
            try {
                await createXcelFile(workbookData, fileName)
                return true;
            } catch (err) {
                return false;
            }
        }],
    }, (e) => {
        if (e) {
            return callback(e)
        }
        const host = process.env.BACKEND_HOST || SERVER_HOST[process.env.NODE_ENV] || SERVER_HOST.development
        return callback(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: `${host}downloads/${fileName}.xlsx`,
            workbookData,
        });
    })
}

module.exports = {
    fetchTeamList,
    createNewTeam,
    getTeamDetails,
    deleteTeam,
    updateTeam,
    fetchCustomersFromUserId,
    checkReviewPercent,
    teamsReport
};
