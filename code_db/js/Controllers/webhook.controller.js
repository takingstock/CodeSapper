const config = require('config');
const { auto } = require('async');
const Axios = require('axios');
const { WebHook } = require('../Models')
const { createMongooseId, isValidUrl } = require('../Utils/universal-functions.util');
const { workflowService } = require('../Services');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

const fetchWebhooks = (user, query, hcb) => {
    const tenantId = createMongooseId(user.tenantId || query.tenantId);
    WebHook.find({ tenantId }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}
const webhookDetail = (user, { webhookId }, hcb) => {
    WebHook.findOne({ _id: createMongooseId(webhookId) }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

const _availableWebhookName = ({ workflowId, tenantId, name }, cb) => {
    const query = {
        tenantId: createMongooseId(tenantId),
        workflowId: createMongooseId(workflowId),
        name
    }
    WebHook.findOne(query, (err, res) => {
        if (!err && !res) {
            return cb(null, true)
        }
        return cb({
            statusCode: 404,
            message: 'Webhook name already used',
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
const createWebhook = (user, payload, hcb) => {
    const tenantId = createMongooseId(user.tenantId || payload.tenantId);
    if (!tenantId) {
        return hcb({
            statusCode: 404,
            message: 'tenantId is required',
        })
    }
    if (!isValidUrl(payload.url)) {
        return hcb({ statusCode: 400, message: "invalid url" })
    }
    auto({
        checkWebhook: (cb) => {
            _availableWebhookName({ tenantId, workflowId: payload.workflowId, name: payload.name }, cb)
        },
        workflow: (cb) => {
            if (!payload.workflowId) {
                return cb()
            }
            _verifyWorflow(payload.workflowId, cb)
        },
        saveWebhook: ['checkWebhook', 'workflow', (_, cb) => {
            const data = { ...payload, tenantId, createdBy: user.id }
            new WebHook(data).save(cb);
        }]
    }, (err, { saveWebhook }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: saveWebhook })
    })
}
const updateWebhook = (user, payload, hcb) => {
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
        checkWebhook: (cb) => {
            if (payload.name) {
                _availableWebhookName({ tenantId, workflowId: payload.workflowId, name: payload.name }, cb)
            }
        },
        workflow: (cb) => {
            if (!payload.workflowId) {
                return cb()
            }
            _verifyWorflow(payload.workflowId, cb)
        },
        updateWebhook: ['checkWebhook', 'workflow', (_, cb) => {
            const data = { updatedBy: user.id }
            if (payload.name) {
                data.name = payload.name;
            }
            if (payload.url) {
                data.url = payload.url
                if (!isValidUrl(payload.url)) {
                    return cb({ statusCode: 400, message: "invalid url" })
                }
            }
            if (payload.method) {
                data.method = payload.method
            }
            if (payload.token) {
                data.token = payload.token
            }
            if (!payload.workflowId) {
                data.workflowId = payload.workflowId
            }
            WebHook.findOneAndUpdate({ _id: createMongooseId(payload.webhookId) }, { $set: data }, { new: true }, cb);
        }]
    }, (err, { updateWebhook }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: updateWebhook })
    })
}
const deleteWebhook = (user, { webhookId }, hcb) => {
    WebHook.deleteOne({ _id: createMongooseId(webhookId) }, { name: 1, url: 1, method: 1 }, (err, hooks) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: hooks })
    })
}

const verifyWebhook = (user, payload, hcb) => {
    auto({
        webHook: (cb) => {
            WebHook.findOne({ _id: payload.webhookId }, (err, res) => {
                if (!res || err) {
                    return hcb({
                        statusCode: 404,
                        message: 'webhook not found',
                    })
                }
                cb(null, res)
            })
        },
        testUrl: ['webHook', ({ webHook }, cb) => {
            const requestConfig = {
                method: webHook.method,
                url: webHook.url,
                data: JSON.stringify({ docId: "testingdocid", docName: "testing invoice", docType: "Invoice" })
            };
            Axios(requestConfig)
                .then((response) => {
                    WebHook.findOneAndUpdate({ _id: webHook._id }, { $set: { status: 'VERIFIED', lastTestResponse: { status: response.status, data: response.data } } }, { new: true }, cb);
                })
                .catch((err) => {
                    console.log(err)
                    WebHook.findOneAndUpdate({ _id: webHook._id }, { $set: { status: 'DOWN', lastTestResponse: { message: err.message, code: err.code } } }, { new: true }, cb);
                })
        }],
    }, (err, { testUrl }) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: testUrl })
    })
}
const sendDataToAPI = (ocrData, batchId, webhookId) => new Promise((resolve) => {
    console.log("data saved", ocrData, batchId, webhookId)
    auto({
        webHook: (cb) => {
            WebHook.findOne({ _id: webhookId }, (err, res) => {
                if (!res || err) {
                    return cb({
                        statusCode: 404,
                        message: 'webhook not found',
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
        hitApi: ['webHook', 'mapData', ({ webHook, mapData: data }, cb) => {
            const requestConfig = {
                method: webHook.method,
                url: webHook.url,
                data: JSON.stringify(data)
            };
            Axios(requestConfig)
                .then((response) => {
                    WebHook.findOneAndUpdate({ _id: webHook._id }, { $set: { status: 'VERIFIED', lastTestResponse: { status: response.status, data: response.data } } }, { new: true }, cb);
                })
                .catch((err) => {
                    console.log(err)
                    WebHook.findOneAndUpdate({ _id: webHook._id }, { $set: { status: 'DOWN', lastTestResponse: { message: err.message, code: err.code } } }, { new: true }, cb);
                })
        }]
    }, (err) => {
        console.log("ERROR WHILE SAVING DATA VIA API", err)
        resolve(true)
    })
})
module.exports = {
    fetchWebhooks,
    webhookDetail,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    verifyWebhook,
    sendDataToAPI
}
