const { getCachePatternMatch, expireCacheCb } = require('./cache')

const clearCacheUserTeams = (cacheKey) => {
    if (!cacheKey) {
        return
    }
    getCachePatternMatch(`*${cacheKey}*`, (e, r) => {
        if (!(r && r[0])) {
            return
        }
        r.forEach(k => {
            console.log("check cache data for:", k)
            if (k && (k.includes("TEAMS") || k.includes("CP"))) {
                console.log("start cache remove")
                expireCacheCb(k, (e, r) => { console.log("cache removed for", k, e, r) });
            }
        })
    })
}
module.exports = {
    clearCacheUserTeams
}
