const config = require('config');
const { auto } = require('async');
const { verifyDirectory } = require('../Utils/input-storage.util')

const { InputStorage } = require('../Models')
const { createMongooseId } = require('../Utils/universal-functions.util');
const { workflowService } = require('../Services');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

const fetchInputStorages = (user, query, hcb) => {
    const tenantId = createMongooseId(user.tenantId || query.tenantId);
    InputStorage.find({ tenantId }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

const inputStorageDetail = (user, { inputStorageId }, hcb) => {
    InputStorage.findOne({ _id: createMongooseId(inputStorageId) }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

const _availableInputStorageName = ({ workflowId, tenantId, name }, cb) => {
    const query = {
        tenantId: createMongooseId(tenantId),
        workflowId: createMongooseId(workflowId),
        name
    }
    InputStorage.findOne(query, (err, res) => {
        if (!err && !res) {
            return cb(null, true)
        }
        return cb({
            statusCode: 404,
            message: 'InputStorage name already used',
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

const createInputStorage = (user, payload, hcb) => {
    const tenantId = createMongooseId(user.tenantId || payload.tenantId);
    if (!tenantId) {
        return hcb({
            statusCode: 404,
            message: 'tenantId is required',
        })
    }
    auto({
        checkInputStorage: (cb) => {
            _availableInputStorageName({ tenantId, workflowId: payload.workflowId, name: payload.name }, cb)
        },
        workflow: (cb) => {
            if (!payload.workflowId) {
                return cb()
            }
            _verifyWorflow(payload.workflowId, cb)
        },
        saveInputStorage: ['checkInputStorage', 'workflow', (_, cb) => {
            const data = { ...payload, tenantId, createdBy: user.id }
            new InputStorage(data).save(cb);
        }]
    }, (err, { saveInputStorage }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: saveInputStorage })
    })
}

const updateInputStorage = (user, payload, hcb) => {
    const tenantId = createMongooseId(user.tenantId || payload.tenantId);
    console.log("USER,USER", user)
    console.log("payload", payload)

    if (!tenantId) {
        return hcb({
            statusCode: 404,
            message: 'tenantId is required',
        })
    }
    auto({
        checkInputStorage: (cb) => {
            if (payload.name) {
                _availableInputStorageName({ tenantId, workflowId: payload.workflowId, name: payload.name }, cb)
            }
        },
        workflow: (cb) => {
            if (!payload.workflowId) {
                return cb()
            }
            _verifyWorflow(payload.workflowId, cb)
        },
        updateInputStorage: ['checkInputStorage', 'workflow', (_, cb) => {
            const data = { updatedBy: user.id }
            if (payload.name) {
                data.name = payload.name;
            }
            if (payload.folderPath) {
                data.folderPath = payload.folderPath
            }
            if (payload.accessKeyId) {
                data.accessKeyId = payload.accessKeyId
            }
            if (payload.secretAccessKey) {
                data.secretAccessKey = payload.secretAccessKey
            }
            if (payload.bucketName) {
                data.bucketName = payload.bucketName
            }
            if (payload.region) {
                data.region = payload.region
            }
            if (payload.workflowId) {
                data.workflowId = payload.workflowId
            }
            InputStorage.findOneAndUpdate({ _id: createMongooseId(payload.inputStorageId) }, { $set: data }, { new: true }, cb);
        }]
    }, (err, { updateInputStorage }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: updateInputStorage })
    })
}

const deleteInputStorage = (user, { inputStorageId }, hcb) => {
    InputStorage.deleteOne({ _id: createMongooseId(inputStorageId) }, { name: 1, url: 1, method: 1 }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

const verifyInputStorage = (user, payload, hcb) => {
    auto({
        storage: (cb) => {
            InputStorage.findOne({ _id: payload.inputStorageId }, (err, res) => {
                if (!res || err) {
                    return hcb({
                        statusCode: 404,
                        message: 'Input Storage not found',
                    })
                }
                cb(null, res)
            })
        },
        testUrl: ['storage', ({ storage }, cb) => {
            verifyDirectory(storage, cb)
        }],
    }, (err, { testUrl }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: testUrl })
    })
}
const startReadingDirectories = () => {

}
module.exports = {
    fetchInputStorages,
    inputStorageDetail,
    createInputStorage,
    updateInputStorage,
    deleteInputStorage,
    verifyInputStorage,
    startReadingDirectories
}
