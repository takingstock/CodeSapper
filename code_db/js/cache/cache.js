const {
    redisClient,
} = require('../Configurations/redis.config');

const getCacheCb = (key) => new Promise((resolve) => {
    redisClient.get(`${key}`, (e, r) => {
        if (!r) {
            return resolve(null)
        }
        resolve(r)
    });
})
const getCache = async (key) => {
    const c = await redisClient.get(`${key}`);
    return c
}
/**
 * Set cache
 * @param {*} key
 * @param {*} value
 * @param {*} expiry default to on hour
 * @returns
 */
const setCache = async (key, value, expiry = 3600) => {
    const c = await redisClient.set(`${key}`, JSON.stringify(value));
    await redisClient.expire(`${key}`, expiry)
    return c
}

/**
 * Set cache with cb function
 * @param {*} key
 * @param {*} value
 * @param {*} expiry default to on hour
 * @param {*} callback
 */
const setCacheCB = (key, value, expiry = 3600) => new Promise((resolve) => {
    redisClient.set(`${key}`, JSON.stringify(value), (e, r) => {
        console.log("CACHE SET:", e, r)
        if (!r) {
            return resolve(null)
        }
        redisClient.expire(`${key}`, expiry, (e, er) => {
            if (!r) {
                return resolve(null)
            }
            resolve(er)
        });
    });
})
const expireCache = async (key) => {
    if (!key) {
        return
    }
    const c = redisClient.expire(`${key}`, 0);
    return c
}
const expireCacheCb = (key, callback) => {
    if (!key) {
        return callback()
    }
    redisClient.expire(`${key}`, 0, callback);
}
const getCachePatternMatch = (pattern, callback) => {
    redisClient.keys(pattern, callback)
}
module.exports = {
    getCacheCb,
    getCache,
    setCache,
    setCacheCB,
    expireCache,
    expireCacheCb,
    getCachePatternMatch
}
