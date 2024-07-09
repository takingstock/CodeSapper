const config = require('config');
const { auto } = require('async');
const { DbConfig } = require('../Models')
const { createMongooseId } = require('../Utils/universal-functions.util');
const { workflowService } = require('../Services');
const { connection, testData, create } = require('../Services/db')

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

const fetchExternalDbConfigs = (user, query, hcb) => {
    const tenantId = createMongooseId(user.tenantId || query.tenantId);
    DbConfig.find({ tenantId }, { passsword: 0 }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}
const externalDbConfigDetail = (user, { dbConfigId }, hcb) => {
    DbConfig.findOne({ _id: createMongooseId(dbConfigId) }, { passsword: 0 }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

const _availableDbConfigName = ({ workflowId, tenantId, name }, cb) => {
    const query = {
        tenantId: createMongooseId(tenantId),
        workflowId: createMongooseId(workflowId),
        name
    }
    DbConfig.findOne(query, (err, res) => {
        if (!err && !res) {
            return cb(null, true)
        }
        return cb({
            statusCode: 404,
            message: 'Db name already used',
        })
    })
}
const _verifyWorflow = (workflowId, cb) => {
    const query = {
        workflowId: createMongooseId(workflowId),
    }
    workflowService.findOne(query, (err, res) => {
        if (err) {
            return cb(err)
        }
        if (!res) {
            return cb({
                statusCode: 404,
                message: 'Invalid workflow',
            })
        }
        return cb(null, true)
    })
}
const createExternalDbConfig = (user, payload, hcb) => {
    const tenantId = createMongooseId(user.tenantId || payload.tenantId);
    if (!tenantId) {
        return hcb({
            statusCode: 404,
            message: 'tenantId is required',
        })
    }
    auto({
        checkDbConfig: (cb) => {
            _availableDbConfigName({ tenantId, workflowId: payload.workflowId, name: payload.name }, cb)
        },
        workflow: (cb) => {
            if (!payload.workflowId) {
                return cb()
            }
            _verifyWorflow(payload.workflowId, cb)
        },
        saveDbConfig: ['checkDbConfig', 'workflow', (_, cb) => {
            const data = { ...payload, tenantId, createdBy: user.id }
            new DbConfig(data).save(cb);
        }]
    }, (err, { saveDbConfig }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: saveDbConfig })
    })
}
const updateExternalDbConfig = (user, payload, hcb) => {
    const tenantId = createMongooseId(user.tenantId || payload.tenantId);
    // console.log("USER,USER", user)
   // console.log("payload", payload)

    if (!tenantId) {
        return hcb({
            statusCode: 404,
            message: 'tenantId is required',
        })
    }
    auto({
        checkDbConfig: (cb) => {
            if (payload.name) {
                _availableDbConfigName({ tenantId, workflowId: payload.workflowId, name: payload.name }, cb)
            }
        },
        workflow: (cb) => {
            if (!payload.workflowId) {
                return cb()
            }
            _verifyWorflow(payload.workflowId, cb)
        },
        updateDbConfig: ['checkDbConfig', 'workflow', (_, cb) => {
            const data = { updatedBy: user.id }
            if (payload.name) {
                data.name = payload.name;
            }
            if (payload.dbName) {
                data.dbName = payload.dbName
            }
            if (payload.tableName) {
                data.tableName = payload.tableName
            }
            if (payload.username) {
                data.username = payload.username
            }
            if (payload.password) {
                data.password = payload.password
            }
            if (payload.url) {
                data.url = payload.url
            }
            if (!payload.dbType) {
                data.dbType = payload.dbType
            }
            DbConfig.findOneAndUpdate({ _id: createMongooseId(payload.dbConfigId) }, { $set: data }, { new: true }, cb);
        }]
    }, (err, { updateDbConfig }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: updateDbConfig })
    })
}
const deleteExternalDbConfig = (user, { dbConfigId }, hcb) => {
    DbConfig.deleteOne({ _id: createMongooseId(dbConfigId) }, { name: 1, url: 1, method: 1 }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

const testConnection = (item, hcb) => {
    // TODO write you testing code here
    connection(item).then((res) => {
        if (!res.sucess) {
            return hcb(null, res)
        }
        create(item, testData()).then(() => {
            hcb(null, res)
        }).catch((error) => {
            hcb(null, { sucess: false, error })
        })
    })
}

const verifyExternalDbConfig = (user, payload, hcb) => {
    // const tenantId = createMongooseId(user.tenantId || payload.tenantId);
    auto({
        dbConfig: (cb) => {
            DbConfig.findOne({ _id: payload.externalDbConfigId }, (err, res) => {
                if (!res || err) {
                    return hcb({
                        statusCode: 404,
                        message: 'Data base configuration not found',
                    })
                }
                cb(null, res)
            })
        },
        testDbConnection: ['dbConfig', ({ dbConfig }, cb) => {
            // test db config
            testConnection(dbConfig, (err, res) => {
                const { sucess = false, error = "something went wrong" } = res
                const dataToSet = { status: "VERIFIED", lastTestResponse: null }
                if (!sucess) {
                    dataToSet.status = "DOWN";
                    dataToSet.lastTestResponse = JSON.stringify(error)
                }
                DbConfig.findOneAndUpdate({ _id: payload.externalDbConfigId }, { $set: dataToSet }, { new: true }, cb)
            })
        }],
    }, (err, { testDbConnection }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: testDbConnection })
    })
}

const sendDataToExternalDb = (ocrData, batchId, externalDbConfigId) => new Promise((resolve) => {
    console.log("ocrData saved", ocrData, batchId, externalDbConfigId)
    auto({
        dbConfig: (cb) => {
            DbConfig.findOne({ _id: externalDbConfigId }, (err, res) => {
                if (!res || err) {
                    return cb({
                        statusCode: 404,
                        message: 'Data base configuration not found',
                    })
                }
                cb(null, res)
            })
        },
        mapData: [(cb) => {
            const finalData = [];
            ocrData.forEach(element => {
                finalData.push(...element.data)
            });
            cb(null, finalData)
        }],
        saveDataInDB: ['dbConfig', 'mapData', ({ dbConfig, mapData: data }, cb) => {
            create(dbConfig, data).then((res) => {
                cb(null, res)
            }).catch((error) => {
                cb(null, { sucess: false, error })
            })
        }],
    }, (err) => {
        console.log("ERROR while saving data in ext database", err)
        resolve(true)
    })
})
module.exports = {
    fetchExternalDbConfigs,
    externalDbConfigDetail,
    createExternalDbConfig,
    updateExternalDbConfig,
    deleteExternalDbConfig,
    verifyExternalDbConfig,
    sendDataToExternalDb
}
