const config = require('config');
const { auto } = require('async');
const crypto = require('crypto');
const IDPKEY = require('../Models/idp-key.model');

const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

const _randomValueHex = (len) => {
    return crypto.randomBytes(Math.ceil(len / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, len).toUpperCase(); // return required number of characters
}
const _generateUniqueKey = () => {
    return `${_randomValueHex(8)}-${_randomValueHex(8)}-${_randomValueHex(8)}`;
}

/**
 * default key generate for tenant
 */
const createKey = (userId, hcb) => {
    const IdpKeyData = { userId };
    if (!userId) {
        return hcb(HTTP_ERROR_MESSAGES.INVALID_TOKEN);
    }
    IdpKeyData.key = _generateUniqueKey()
    const Idpkey = new IDPKEY(IdpKeyData)
    Idpkey.save((err, key) => {
        if (err) {
            return hcb(err)
        }
        return hcb(null, key)
    })
}

/**
 * Refresh or request a new key
 * @param {*} param0
 * @param {*} hcb
 * @returns
 */
const generateApiKey = ({ id: userId }, hcb) => {
    auto({
        IdpKey: (cb) => {
            IDPKEY.findOne({ userId }, cb)
        },
        createKey: ['IdpKey', ({ IdpKey }, cb) => {
            const IdpKeyData = { userId };
            if (IdpKey) {
                return cb(null, null)
            }
            IdpKeyData.key = _generateUniqueKey()
            const Idpkey = new IDPKEY(IdpKeyData)
            Idpkey.save(cb)
        }],
        updateKey: ['IdpKey', ({ IdpKey }, cb) => {
            if (!IdpKey) {
                return cb(null, null)
            }
            IDPKEY.findOneAndUpdate({ userId }, { $set: { key: _generateUniqueKey(), refreshTime: new Date() } }, { new: true }, cb);
        }]
    }, (err, { createKey, updateKey }) => {
        console.log("createKey, updateKey", createKey, updateKey)
        if (err) {
            return hcb(err)
        }
        hcb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: createKey || updateKey
        })
    })
}

/**
 * Get key
 * @param {*} payload
 * @param {*} hcb
 */
const fetchApiKey = ({ id }, hcb) => {
    IDPKEY.findOne({ userId: id }, (err, key) => {
        if (err) {
            return hcb(err)
        }
        hcb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: key
        });
    })
}

/**
 * verify key for auth
 * @param {*} key
 * @returns
 */
const verifyIdpKey = async (key) => {
    try {
        const Idpkey = await IDPKEY.findOne({ key }).populate("userId").populate(
            {
                path: 'userId',
                populate: {
                    path: 'roleId'
                }
            }
        )
        if (!Idpkey || !Idpkey.userId) {
            return false
        }
        Idpkey.user = {
            id: Idpkey.userId._id,
            email: Idpkey.userId.email,
            role: Idpkey.userId.roleId.role,
            tenantId: Idpkey.userId.tenantId || null,
            whiteListIp: Idpkey.whiteListIp || []
        }
        delete Idpkey.userId
        return Idpkey
    } catch (err) {
        console.log("ERROR", err)
        return {}
    }
}

/**
 * update data coresponding to key
 * @param {*} param0
 * @param {*} payload
 * @param {*} params
 * @param {*} hcb
 * @returns
 */
const updateKeyData = ({ id }, { ipAddress }, params, queryParams, hcb) => {
    // /[TODO]
    IDPKEY.findOneAndUpdate({ userId: id }, { $set: { whiteListIp: ipAddress } }, { new: true }, (err, key) => {
        if (err) {
            return hcb(err)
        }
        hcb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: key
        });
    })
    // Idpkey.whiteListIp = [...new set(...Idpkey.whiteListIp.filter(e => e == "All").concat(payload.whiteListIp))]$pull
    // Idpkey.save(hcb)
}

/**
 * Delete Key Data
 * @param {*} param0
 * @param {*} param1
 * @param {*} params
 * @param {*} queryParams
 * @param {*} hcb
 */
const deleteKeyData = ({ id }, { ipAddress }, params, queryParams, hcb) => {
    IDPKEY.findOneAndUpdate({ userId: id }, { $pull: { whiteListIp: ipAddress } }, { new: true }, (err, key) => {
        if (err) {
            return hcb(err)
        }
        hcb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: key
        });
    })
}
module.exports = {
    createKey,
    fetchApiKey,
    updateKeyData,
    deleteKeyData,
    verifyIdpKey,
    generateApiKey
};
