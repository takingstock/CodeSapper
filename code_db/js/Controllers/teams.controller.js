const config = require('config');
const { auto } = require('async');
const { eachOfSeries } = require('async');
const { teamsService } = require('../Services');
const { userService, customersService } = require('../Services');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const {
    createMongooseId,
} = require('../Utils/universal-functions.util');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');

const APP_EVENTS = config.get('APP_EVENTS');

const details = (usersArray, cb) => {
    // console.log("userArray", usersArray)
    const criteria = {
        _id: { $in: usersArray },
        isDeleted: false,
    }
    userService.findAll(criteria, { email: 1 }, { lean: true }, (err, response) => {
        if (err) {
            return cb(err);
        }
        // console.log("FINALARR-->", response)
        return cb(null, response);
    });
}

// check If Not Default SuperVisor

const checkSuperVisor = (payload, tenantId, callback) => {
    const criteria = {
        isDeleted: false,
        tenantId: createMongooseId(tenantId),
    }
      criteria['_id'] = { $in: payload.superVisorId.map(e => createMongooseId(e)) }
      console.log("criteria---->", criteria)
      userService.findAll(criteria, { isDefault: 1 }, { lean: true }, (err, res) => {
        if (err) {
            return console.log(err)
        }
        console.log("RESPONSE +++++++", res)
        if (res && res.length) {
            for (let i = 0; i < res.length; i++) {
                if (res[i].isDefault === true && payload.teamName !== 'Default Team') {
                    // return callback({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: 'Default SuperVisor can only be in Default Team' })
                    return callback(null, false)
                }
            }
        }
        callback(null, true)
      })
}
/**
 * users create
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const createNewTeam = ({ id, tenantId }, payload, hcb) => {
    let flag = false
    if (!(payload.superVisorId && payload.superVisorId.length)) {
        return hcb({
            ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
            message: "Cannot create team without supervisor"
        })
    }
    auto({
        checkForDefaultSuperVisor: (cb) => {
            console.log("INNN PAYLOAD====>", payload)
            checkSuperVisor(payload, tenantId, (err, result) => {
                console.log("result===>", result);
                if (!(result)) {
                    return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: 'Default SuperVisor can only be in Default Team' })
                }
                cb()
            })
        },
        isTeamAlreadyExist: ['checkForDefaultSuperVisor', (res, cb) => {
            teamsService.findOne(
                { teamName: payload.teamName, tenantId },
                {}, { lean: true },
                (err, response) => {
                    if (err) {
                        return cb(err);
                    }
                    if (response) {
                        flag = true;
                        return cb(null, true);
                    }
                    return cb(null, false);
                },
            );
        }],
        customersArrayUpdating: ['isTeamAlreadyExist', (results, cb) => {
            if (flag === true || !(payload.customersArray && payload.customersArray.length)) {
                return cb()
            }
            auto({
                removeExistingCustomers: (ecb) => {
                    if (payload.customersArray && payload.customersArray.length) {
                        const criteria = { customersArray: { $in: payload.customersArray }, tenantId }
                        const dataToSet = { $pullAll: { customersArray: payload.customersArray } }
                        // console.log("CC----->", JSON.stringify(criteria), JSON.stringify(dataToSet))
                        customersService.updateAll(criteria, dataToSet, { lean: true, new: true }, (err, response) => {
                            if (err) {
                                return ecb(err);
                            }
                            console.log("response for remove Indexer in update User-->", response);
                            ecb();
                        })
                    } else {
                        ecb()
                    }
                },
                createTeamInCustomer: ['removeExistingCustomers', (res, ecb) => {
                    customersService.findOne({ teamName: payload.teamName, tenantId }, {}, {}, (err, res) => {
                        if (err) {
                            return ecb(err);
                        }
                        if (!res) {
                            const body = {
                                teamName: payload.teamName,
                                customersArray: payload.customersArray,
                                tenantId,
                                isDefault: payload.teamName && payload.teamName === "Default Team",
                                createdBy: id,
                                reviewPercent: payload.reviewPercent || 0
                            };
                            customersService.create(body, (err) => {
                                if (err) {
                                    return ecb(err);
                                }
                                ecb()
                            });
                        } else {
                            const addToSet = { $addToSet: { customersArray: payload.customersArray } }
                            customersService.update({ teamName: payload.teamName, tenantId }, addToSet, { lean: true, new: true }, (err, response) => {
                                if (err) {
                                    return ecb(err);
                                }
                                console.log("addtoset response::::", response)
                                ecb()
                            });
                        }
                    });
                }],
            }, cb)
        }],
        createNewTeam: ['isTeamAlreadyExist', (results, cb) => {
            if (flag === true) {
                return cb(HTTP_ERROR_MESSAGES.TEAM_ALREADY_EXIST)
            }
            const body = {
                teamName: payload.teamName
            }
            const criteria = { superVisorId: { $in: payload.superVisorId.map(e => createMongooseId(e)) } }
            teamsService.updateAll(criteria, body, (err, response) => {
                if (err) {
                    cb(err)
                }
                // console.log(response)
                return cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    data: response
                });
            });
        }],
    }, (err, result) => {
        if (err) {
            return hcb(err);
        }
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "TEAMS" });
        return hcb(null, result.createNewTeam);
    });
};

// eslint-disable-next-line no-unused-vars
const updateMembersOfTeam = ({ id, tenantId }, payload, hcb) => {
    // let flag = false
    let teamNameFromCustomer = null;
    let existingCustomersArray = []
    // TODO check SAME TEAM NAME UPDATING
    // let details = null
    // console.log(payload)
    auto({
        checkForDefaultSuperVisor: (cb) => {
            console.log("INNN PAYLOAD====>", payload)
            checkSuperVisor(payload, tenantId, (err, result) => {
                console.log("result===>", result);
                if (!(result)) {
                    return cb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: 'Default SuperVisor can only be in Default Team' })
                }
                cb()
            })
        },
        checkIfDefaultTeam: ['checkForDefaultSuperVisor', (res, cb) => {
            customersService.findOne(
                { _id: payload._id, tenantId },
                { isDefault: 1 }, { lean: true },
                (err, response) => {
                    if (err) {
                        return cb(err);
                    }
                    if (response && response.isDefault === false) {
                        cb()
                    } else {
                        // flag = true;
                        return cb({
                            ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                            message: "Cannot Make Changes in Default Team"
                        });
                    }
                },
            );
        }],
        isTeamAlreadyExist: ['checkIfDefaultTeam', (res, cb) => {
            customersService.findOne(
                { teamName: payload.teamName, _id: { $nin: [createMongooseId(payload._id)] }, tenantId },
                {}, { lean: true },
                (err, response) => {
                    if (err) {
                        return cb(err);
                    }
                    if (response) {
                        // flag = true;
                        return cb({
                            ...HTTP_ERROR_MESSAGES.BAD_REQUEST,
                            message: 'TEAM NAME NOT AVAILABLE'
                        });
                    }
                    return cb(null, false);
                },
            );
        }],
        fetchTeamNameFromCustomers: ['checkIfDefaultTeam', (res, cb) => {
            let criteria = {}
            criteria = { _id: payload._id }
            customersService.findOne(criteria, { teamName: 1, customersArray: 1 }, { lean: true }, (err, response) => {
                if (err) {
                    return cb(err);
                }
                if (response) {
                    // console.log("customer teamName response", response)
                    teamNameFromCustomer = response.teamName
                    // details = response
                    // flag = true;
                    return cb(null, true);
                }
                return cb(null, false);
            });
        }],
        updateTeamDetails: ['fetchTeamNameFromCustomers', (results, cb) => {
            // console.log(results)
            // if (results.isTeamAlreadyExist) {
            auto({
                removeExistingSuperVisors: (ecb) => {
                    const criteria = { teamName: teamNameFromCustomer, tenantId }
                    if (payload.superVisorId && payload.superVisorId.length) {
                        criteria.superVisorId = { $nin: payload.superVisorId.map(e => createMongooseId(e)) }
                    } else {
                        return ecb()
                    }
                    const dataToSet = { teamName: 'Default Team' }
                    // team A = [1, 2, 3]
                    // [3, 5, 6]
                    teamsService.updateAll(criteria, { $set: dataToSet }, { lean: true, new: true }, (err) => {
                        if (err) {
                            return ecb(err);
                        }
                        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
                        // console.log("response for remove SuperVisor in update User-->", response);
                        ecb();
                    })
                },
                addNewSuperVisorsToTeam: ['removeExistingSuperVisors', (res, ecb) => {
                    const criteria = {}
                    if (payload.superVisorId && payload.superVisorId.length) {
                        criteria.superVisorId = { $in: payload.superVisorId.map(e => createMongooseId(e)) }
                        // criteria.superVisorId = payload.superVisorId.map(e => createMongooseId(e))
                    }
                    const teamName = payload.teamName || teamNameFromCustomer
                    const dataToSet = { $set: { teamName } }
                    // console.log("criteria")
                    teamsService.updateAll(criteria, dataToSet, { lean: true, new: true }, (err) => {
                        if (err) {
                            return ecb(err);
                        }
                        // console.log("response for update User-->", response);
                        ecb();
                    })
                }]
            }, (err, results) => {
                if (err) {
                    // console.log(err)
                    return cb(err);
                }
                cb(null, results);
            })
        }],
        updateCustomers: ['isTeamAlreadyExist', 'fetchTeamNameFromCustomers', (results, cb) => {
            auto({
                fetchCustomerArrays: (ecb) => {
                    const criteria = { teamName: payload.teamName, tenantId }
                    customersService.findOne(criteria, {}, { lean: true }, (err, res) => {
                        if (err) {
                            return ecb(err);
                        }
                        existingCustomersArray = (res && res.customersArray) || []
                        console.log("response for remove Customers in Delete teams IN UPDATE -->", res);
                        return ecb();
                    })
                },
                removeExistingCustomers: ['fetchCustomerArrays', (res, ecb) => {
                    if (payload.customersArray && payload.customersArray.length) {
                        const criteria = { customersArray: { $in: payload.customersArray }, tenantId }
                        const dataToSet = { $pullAll: { customersArray: payload.customersArray } }
                        // console.log("CC----->", JSON.stringify(criteria), JSON.stringify(dataToSet))
                        customersService.updateAll(criteria, dataToSet, { lean: true, new: true }, (err, response) => {
                            if (err) {
                                return ecb(err);
                            }
                            console.log("response for remove Indexer in update User-->", response);
                            ecb();
                        })
                    } else {
                        ecb()
                    }
                }],
                addCustomersToDefaultTeam: ['removeExistingCustomers', (res, ecb) => {
                    const tempArr = []
                    existingCustomersArray.forEach(c => {
                        if (!(payload.customersArray.includes(c))) {
                            tempArr.push(c)
                        }
                    })
                    // console.log("tempArr--->", tempArr)
                    if (tempArr && tempArr.length) {
                        const criteria = { teamName: 'Default Team', tenantId }
                        const dataToSet = { $addToSet: { customersArray: tempArr } }
                        customersService.updateAll(criteria, dataToSet, { lean: true, new: true }, (err, res) => {
                            if (err) {
                                return ecb(err);
                            }
                            console.log("response for remove Customers in update User-->", res);
                            ecb();
                        })
                    } else {
                        ecb()
                    }
                }],
                addNewCustomersToNewTeam: ['addCustomersToDefaultTeam', (res, ecb) => {
                    const teamName = payload.teamName || teamNameFromCustomer
                    const criteria = { tenantId, teamName: teamNameFromCustomer }
                    const dataToSet = { customersArray: payload.customersArray, teamName }
                    if (payload.hasOwnProperty('reviewPercent')) {
                        dataToSet['reviewPercent'] = payload.reviewPercent
                    }
                    customersService.updateAll(criteria, { $set: dataToSet }, { lean: true, new: true }, (err, response) => {
                        if (err) {
                            return ecb(err);
                        }
                        console.log("response for update User-->", response);
                        ecb();
                    })
                }]
            }, (err, results) => {
                if (err) {
                    // console.log(err)
                    return cb(err);
                }
                cb(null, results);
            })
        }],

    }, (err, result) => {
        if (err) {
            return hcb(err);
        }
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "TEAMS" });
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: result.updateCustomers });
    });
}

const getTeamWithCustomerList = (_, payload, hcb) => {
    const criteria = {}
    if (payload.teamName) {
        criteria.teamName = payload.teamName
    }
    auto({
        getAllTeamList: (cb) => {
            customersService.findAll(criteria, { teamName: 1, customersArray: 1 }, { lean: true }, (err, response) => {
                if (err) {
                    return cb(err);
                }
                return cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    data: response
                });
            });
        },
    }, (err, result) => {
        if (err) {
            return hcb(err);
        }
        return hcb(null, result.getAllTeamList);
    });
}

const getTeamDetails = ({ tenantId }, payload, hcb) => {
    // let totalCount = 0
    let startIndex = null
    // const finalTeams = {}
    // let endIndex = null
    // let finalResponse = {}
    if (payload.pageNo) {
        startIndex = ((payload.pageNo) - 1) * payload.limit
        // endIndex = payload.pageNo * payload.limit
    }
    const criteria = { tenantId }
    // const allTeamIds = {}
    const criteriaCus = { tenantId }
    if (payload._id) {
        criteriaCus._id = payload._id
    }
    if (payload && payload.teamName) {
        criteriaCus.teamName = { $regex: payload.teamName, '$options': 'i' }
    }
    // console.log("criteriaCus--->", criteriaCus)
    auto({
        "getTotalCountFromCustomers": (icb) => {
            customersService.count(criteriaCus, icb)
        },
        "getTeamIdsFromCustomers": (icb) => {
            customersService.findAll(criteriaCus, { teamName: 1, reviewPercent: 1, isDefault: 1, createdAt: 1, updatedAt: 1, customersArray: 1 }, { lean: true, sort: { updatedAt: -1 }, offset: startIndex, limit: payload.limit }, (err, response) => {
                if (err) {
                    return icb(err)
                }
                // console.log("response customer:======>", response)
                return icb(null, response)
            })
        },
        "getTeamDetails": ["getTotalCountFromCustomers", "getTeamIdsFromCustomers", (res, icb) => {
            const teamNames = []
            const teamLists = {}
            // console.log("RESULT FROM +++++++>>>>>", res.getTeamIdsFromCustomers)
            res.getTeamIdsFromCustomers.forEach(e => {
                // console.log("Teams E--->:", e)
                teamNames.push(e.teamName)
                teamLists[e.teamName] = e
                teamLists[e.teamName]["superVisorId"] = []
                teamLists[e.teamName]["indexerArray"] = []
            })
            // teamNames.push('Default Team')
            // console.log("teamLists Above :::+++++++", teamLists, teamNames)
            if (teamNames && teamNames.length) {
                criteria.teamName = { $in: teamNames }
            }
            // console.log("team criteria:::", criteria)
            teamsService.findAll(criteria, { teamName: 1, superVisorId: 1, indexerArray: 1, tenantId: 1, createdAt: 1 }, { lean: true }, (err, response) => {
                if (err) {
                    return icb(err);
                }
                // console.log("response:::", response)
                // totalCount = response.length;
                for (const eachTeam of response) {
                    // console.log("each Team:::", eachTeam)
                    // if (Object.keys(teamLists).length === 0 || (!(teamLists.hasOwnProperty(eachTeam.teamName)))) {
                    //     console.log("INNNNNNNN")
                    //     teamLists[eachTeam.teamName] = eachTeam
                    //     teamLists[eachTeam.teamName]["superVisorId"] = []
                    //     teamLists[eachTeam.teamName]["indexerArray"] = []
                    // }
                    // else {
                        teamLists[eachTeam.teamName]["superVisorId"].push(eachTeam.superVisorId)
                        teamLists[eachTeam.teamName]["indexerArray"] = [...teamLists[eachTeam.teamName]["indexerArray"], ...eachTeam["indexerArray"]]
                    // }
                    // if (eachTeam.teamName === 'Default Team') {
                    //     teamLists[eachTeam.teamName]['isDefault'] = true
                    // } else {
                    //     teamLists[eachTeam.teamName]['isDefault'] = false
                    // }
                }
                // console.log("teamLists====>+++++++", teamLists)
                eachOfSeries(Object.values(teamLists), (team, key, ecb) => {
                    auto({
                        'getUsers': (cb) => {
                            details(team.indexerArray, (err, response) => {
                                team.indexerArray = response || []
                                // console.log("inside get users--->", response, team)
                                cb()
                            })
                        },
                        'getSupervisors': ['getUsers', (res, cb) => {
                            details(team.superVisorId, (err, response) => {
                                team.superVisorId = response || []
                                // console.log("inside supervisors--->", response, team)
                                cb()
                            })
                        }],
                    }, (err, res) => {
                        // console.log("inside ecb")
                        if (err) {
                            console.log("ecb error::::", err)
                            return ecb(err)
                        }
                        return ecb(null, res)
                    })
                }, (err) => {
                    // console.log("returning promise", teamLists)
                    if (err) {
                        return icb(err)
                    }
                    return icb(null, (Object.values(teamLists)).sort((teamA, teamB) => (teamA.updatedAt < teamB.updatedAt ? 1 : -1)));
                })
            })
        }],
    }, (err, res) => {
        // console.log("inside ecb")
        if (err) {
            console.log("ecb error::::", err)
            return hcb(err)
        }
        return hcb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: res.getTeamDetails,
            totalCount: res.getTotalCountFromCustomers,
        })
    })
}
/**
 * users delete
 * @param {Object} userInfo
 * @param {Object} params
 * @returns
 */
const deleteTeam = ({ tenantId }, payload, hcb) => {
    // eslint-disable-next-line no-unused-vars
    let details = null;
    let existingCustomersArray = []
    if (payload.teamName === 'Default Team') {
        return hcb({ ...HTTP_ERROR_MESSAGES.BAD_REQUEST, message: "You cannot delete default team" })
    }
    auto({
        fetchTeamDetails: (cb) => {
            teamsService.findOne({ teamName: payload.teamName, tenantId }, {}, { lean: true }, (err, response) => {
                if (err) {
                    console.log("ERROR", err)
                    return cb(err);
                }
                if (!(response)) {
                    return cb({ ...HTTP_ERROR_MESSAGES.NOT_FOUND, message: "Team not found" })
                }
                // console.log("SUCCESS", response)
                details = response
                return cb();
            });
        },
        addSuperVisorsToDefaultTeam: ['fetchTeamDetails', (res, cb) => {
            const criteria = { teamName: payload.teamName, tenantId }
            const dataToSet = { teamName: 'Default Team' }
            teamsService.updateAll(criteria, { $set: dataToSet }, { lean: true }, (err) => {
                if (err) {
                    return cb(err);
                }
                // console.log("response for remove SuperVisor in Delete teams-->", response);
                return cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
                });
            })
        }],
        addCustomerToDefaultTeam: ['fetchTeamDetails', (res, cb) => {
            auto({
                fetchCustomerArrays: (ecb) => {
                    const criteria = { teamName: payload.teamName, tenantId }
                    customersService.findOne(criteria, {}, { lean: true }, (err, res) => {
                        if (err) {
                            return ecb(err);
                        }
                        existingCustomersArray = (res && res.customersArray) || []
                        // console.log("response for remove customer in Delete teams IN DELETE-->", res);
                        return ecb();
                    })
                },
                addCustomersToDefaultTeam: ['fetchCustomerArrays', (res, ecb) => {
                    const criteria = { teamName: 'Default Team', tenantId }
                    // if (payload.customersArray && payload.customersArray.length) {
                    //     criteria.customersArray = { $nin: payload.customersArray }
                    // } else {
                    //     return ecb()
                    // }
                    const dataToSet = { $addToSet: { customersArray: existingCustomersArray } }
                    customersService.updateAll(criteria, dataToSet, { lean: true, new: true }, (err) => {
                        if (err) {
                            return ecb(err);
                        }
                        // console.log("response for remove customer in update User IN DELETE-->", response);
                        ecb();
                    })
                }]
            }, cb)
        }],
        deleteTeamFromCustomers: ['addCustomerToDefaultTeam', (res, cb) => {
            const criteria = { teamName: payload.teamName, tenantId }
            customersService.deleteOne(criteria, (err) => {
                if (err) {
                    return cb(err);
                }
                // console.log("response for remove SuperVisor in Delete teams-->", response);
                return cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
                });
            })
        }]

    }, (err, result) => {
        if (err) {
            return hcb(err);
        }
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "TEAMS" });
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "USERS" });
        return hcb(null, result.deleteTeamFromCustomers);
    })
};
const addCustomersToTeam = ({ id, tenantId }, payload, hcb) => {
    let teamExists = false
    let customerTeamCreated = false
    auto({
        checkIfTeamExists: (cb) => {
            customersService.count({ teamName: payload.teamName }, (err, response) => {
                if (err) {
                    console.log("ERROR", err)
                    return cb(err);
                }
                if (response === 1) {
                    teamExists = true
                }
                return cb();
            });
        },
        createNewCustomerTeam: ['checkIfTeamExists', (res, cb) => {
            if (!teamExists) {
                const body = {
                    teamName: payload.teamName,
                    customersArray: payload.customersArray,
                    tenantId,
                    createdBy: id,
                };
                customersService.create(body, (err) => {
                    if (err) {
                        return cb(err);
                    }
                    customerTeamCreated = true
                    return cb(null, {
                        ...HTTP_SUCCESS_MESSAGES.DEFAULT
                    });
                });
            } else {
                return cb()
            }
        }],
        addCustomersToTeam: ['createNewCustomerTeam', (res, cb) => {
            if (customerTeamCreated) {
                return cb(null, res.createNewCustomerTeam)
            }
            // console.log("in add customer to team")
            const dataToSet = { $addToSet: { customersArray: { $each: payload.customersArray } }, updatedBy: id }
            customersService.update({ teamName: payload.teamName, tenantId }, dataToSet, {}, (err) => {
                if (err) {
                    console.log("ERROR", err)
                    return cb(err);
                }
                return cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                });
            });
        }]
    }, (err, result) => {
        if (err) {
            return hcb(err);
        }
        return hcb(null, result.addCustomersToTeam);
    });
};
const deleteCustomersFromTeam = ({ id }, payload, hcb) => {
    let teamExists = false
    auto({
        checkIfTeamExists: (cb) => {
            customersService.count({ teamName: payload.teamName }, (err, response) => {
                if (err) {
                    console.log("ERROR", err)
                    return cb(err);
                }
                if (response === 1) {
                    teamExists = true
                }
                return cb();
            });
        },
        deleteCustomersFromTeam: ['checkIfTeamExists', (res, cb) => {
            if (!teamExists) {
                return cb(null, "TEAM DOES NOT EXIST")
            }
            const dataToSet = { $pull: { customersArray: { $in: payload.customersArray } }, updatedBy: id }
            customersService.update({ teamName: payload.teamName }, dataToSet, {}, (err) => {
                if (err) {
                    console.log("ERROR", err)
                    return cb(err);
                }
                // console.log("customer update res:::::", response)
                return cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                });
            });
        }],
    }, (err, result) => {
        if (err) {
            return hcb(err);
        }
        return hcb(null, result.deleteCustomersFromTeam);
    });
};

module.exports = {
    updateMembersOfTeam,
    createNewTeam,
    getTeamDetails,
    deleteTeam,
    getTeamWithCustomerList,
    addCustomersToTeam,
    deleteCustomersFromTeam
};
