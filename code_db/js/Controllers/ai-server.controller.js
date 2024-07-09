const { auto } = require('async');
const config = require('config');
const AI_SERVER = require('../Models/ai-server-model')
const WORKFLOW = require('../Models/workflow.model')
const { aiServersHealthCb } = require('./health.controller')

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const createServer = (payload, hcb) => {
    auto({
        aiserver: (cb) => {
            AI_SERVER.findOne({ name: payload.name }, cb)
        },
        createAiServer: ['aiserver', ({ aiserver }, cb) => {
            if (aiserver) {
                return cb({ statusCode: 400, message: 'Server name Already exist' })
            }
            const data = {
                healthOcr: payload.healthOcr || '',
                documentOcr: payload.documentOcr,
                healthFeedback: payload.healthFeedback || '',
                tabularFeedback: payload.tabularFeedback,
                nonTabularFeedback: payload.nonTabularFeedback,
                healthDocumentBucketing: payload.healthDocumentBucketing || '',
                documentBucketing: payload.documentBucketing,
                documentSnipplet: payload.documentSnipplet,
                updateFlags: payload.updateFlags,
                name: payload.name
            }
            new AI_SERVER(data).save(cb)
        }]
    }, (err, { createAiServer }) => {
        if (err) {
            hcb(err)
        }
        hcb(err, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: createAiServer });
    })
}

const updateServer = (payload, param, hcb) => {
    auto({
        aiserver: (cb) => {
            AI_SERVER.findOneAndUpdate({ _id: param.serverId }, { $set: payload }, { new: true }, cb)
        }
    }, (err, { aiserver }) => {
        if (err) {
            return hcb(err)
        }
        hcb(err, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: aiserver })
    })
}

const deleteServer = (param, hcb) => {
    auto({
        aiserver: (cb) => {
            AI_SERVER.deleteOne({ _id: param.serverId }, cb)
        },
        updateWorkflows: (cb) => {
            WORKFLOW.updateMany({ aiServerId: param.serverId }, { $set: { aiServerId: null } }, cb)
        }
    }, (err, { aiserver }) => {
        if (err) {
            return hcb(err)
        }
        hcb(err, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: { aiserver } })
    })
}
const addAiServerToWorkflow = (payload, hcb) => {
    auto({
        aiserver: (cb) => {
            AI_SERVER.findOne({ _id: payload.serverId }, cb)
        },
        addAiServer: ['aiserver', ({ aiserver }, cb) => {
            if (!aiserver) {
                return cb({ statusCode: 400, message: 'ai Server not available' })
            }
            WORKFLOW.updateOne({ _id: payload.workflowId }, { $set: { aiServerId: payload.serverId } }, cb);
        }]
    }, (err, { addAiServer }) => {
        if (err) {
            hcb(err)
        }
        hcb(err, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: addAiServer });
    })
}
const fetchServers = ({
    q = '', limit = 10, offset = 0, sortBy = 'createdAt', orderBy = 'DESC'
}, hcb) => {
    const sortObj = {
        [sortBy]: orderBy === 'DESC' ? -1 : 1,
    };
    auto({
        aiservers: (cb) => {
            const criteria = {}
            if (q) {
                criteria.name = {
                    $regex: q,
                    $options: 'i'
                }
            }
            AI_SERVER.aggregate([{ $match: criteria },
            {
                $facet: {
                    aiservers: [{ $sort: sortObj }, { $skip: offset * limit }, { $limit: limit }],
                    count: [{
                        $group: {
                            count: { $sum: 1 },
                            _id: null,
                        },
                    }]
                }
            }], (err, result) => {
                const { aiservers: data, count } = result[0];
                cb(null, {
                    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
                    data,
                    totalCount: count[0] && count[0].count ? count[0].count : 0
                })
            })
        },
        addServerHealth: ['aiservers', ({ aiservers }, cb) => {
            aiServersHealthCb(aiservers.data, cb)
        }]
    }, (err, { addServerHealth }) => {
        if (err) {
            hcb(err)
        }
        hcb(err, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: addServerHealth })
    })
}
const serverDetails = ({ serverId }, hcb) => {
    auto({
        aiserver: (cb) => {
            AI_SERVER.findOne({ _id: serverId }, cb)
        },
    }, (err, { aiserver }) => {
        if (err) {
            hcb(err)
        }
        hcb(err, { ...HTTP_SUCCESS_MESSAGES.DEFAULT, data: aiserver })
    })
}
module.exports = {
    createServer,
    updateServer,
    deleteServer,
    addAiServerToWorkflow,
    fetchServers,
    serverDetails
};
