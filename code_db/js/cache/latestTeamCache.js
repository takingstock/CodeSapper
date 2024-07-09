const { getCacheCb,
    setCacheCB,
    expireCacheCb } = require("./cache")

const PREFIX = "TEAMS"
const get = async (key) => {
    try {
        const c = await getCacheCb(`${PREFIX}_${key}`);
        if (c) {
            return JSON.parse(c)
        }
        return null
    } catch (e) {
        return null
    }
}
const set = async (key, value) => {
    try {
        const c = await setCacheCB(`${PREFIX}_${key}`, value);
        if (c) {
            return JSON.parse(c)
        }
        return null
    } catch (e) {
        return null
    }
}
const remove = (key, callback) => {
    expireCacheCb(`${PREFIX}_${key}`, callback);
}
module.exports = {
    get,
    set,
    remove
};
