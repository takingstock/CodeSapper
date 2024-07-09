const config = require('config');
const axios = require('axios');
const { auto } = require('async');

const httpClient = axios.create();
const AXIOS_TIMEOUT = config.get('SERVER.AXIOS_TIMEOUT');

httpClient.defaults.timeout = AXIOS_TIMEOUT;
const qcUrl = 'https://shareddb.amygbserver.in/api'
const token = '12ffacbce0aa53b4892fd9feca643dea'

const getDocument = (query, callback) => {
    const headers = { authorization: `Bearer ${token}` };
    const queryCondition = Object.keys(query).map(q => `${q}=${query[q]}`).join('&')
    auto({
        document: (cb) => {
            httpClient.get(`${qcUrl}/document?${queryCondition}`, { headers })
                .then(res => {
                    console.log("reddddddddddd doc", JSON.stringify(res.data))
                    return cb(null, res.data.data && res.data.data[0])
                }).catch(err => {
                    console.log("ERRRRRRRRRRRRRRRRRRR doc", err)
                    return cb(null, err)
                })
        }
    }, (err, { document }) => {
        if (err) {
            return callback(null, null)
        }
        return callback(null, document)
    })
}

const getDocuments = (query, callback) => {
    const headers = { authorization: `Bearer ${token}` };
    const queryCondition = Object.keys(query).map(q => `${q}=${query[q]}`).join('&')
    auto({
        document: (cb) => {
            httpClient.get(`${qcUrl}/documents?${queryCondition}`, { headers }).then(res => cb(null, res.data)).catch(err => cb(null, err))
        }
    }, (err) => {
        if (err) {
            return callback(null, false)
        }
        return callback(null, true)
    })
}

const updateDocument = ({ nonTabularError, _id }, callback) => {
    const headers = { authorization: `Bearer ${token}` }
    auto({
        sharedDocument: (cb) => {
            getDocument({ doc_id: _id }, cb)
        },
        qc: ['sharedDocument', ({ sharedDocument }, cb) => {
            const dataToSet = { non_table_content: sharedDocument.non_table_content, action_point: "QC", doc_id: _id, customer_id: sharedDocument.customer_id }
            dataToSet.non_table_content.forEach(nt => {
                delete nt._id
                if (nonTabularError[nt.key]) {
                    nt.qc_error_type = nonTabularError[nt.key]
                }
            })
            httpClient.put(`${qcUrl}/document`, dataToSet, { headers }).then(res => {
                return cb(null, res.data)
            }).catch(err => {
                return cb(null, err)
            })
        }]
    }, (err) => {
        console.log("ERROR DURING QC", err)
        if (err) {
            return callback(null, false)
        }
        return callback(null, true)
    })
}

const deleteDocument = () => {

}
module.exports = {
    getDocument,
    getDocuments,
    updateDocument,
    deleteDocument
}
