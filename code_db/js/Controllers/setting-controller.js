const { auto } = require('async');
const config = require('config');
const TENANT_SETTING = require('../Models/tenant-setting.model')

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

const fetchSettting = ({ tenantId }, hcb) => {
    auto({
        findSetting: (cb) => {
            TENANT_SETTING.findOne({ tenantId }, cb)
        },
        createSetting: ['findSetting', ({ findSetting }, cb) => {
            if (!findSetting) {
                new TENANT_SETTING({
                    tenantId,
                    storageLimit: 25000,
                    storageUsed: 0
                }).save(cb)
            } else {
                cb(null, null)
            }
        }]
    }, (err, { findSetting, createSetting }) => {
        if (err) {
            hcb(err)
        }

        hcb(err, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: createSetting || findSetting
        })
    })
}
module.exports = {
    fetchSettting
};
