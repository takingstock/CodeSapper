const config = require('config');
const mongoose = require('mongoose');
const Models = require('../Models');

const modelName = config.get('SCHEMA.BOlVENDORS');

let bolVendorInUse = null;
const currentVendorInuse = (callback) => {
    if (bolVendorInUse) {
        return callback(null, bolVendorInUse)
    }
    Models.CurrentVendor.findOne({ seedId: 11 }, (e, r) => {
        console.log("CURRENT VENDOR IN USE: e,r: ", e, r)
        if (e) {
            return callback(e)
        }
        bolVendorInUse = (r && r.collectionName) || modelName
        console.log("CURRENT VENDOR IN USE: bolVendorInUse ", bolVendorInUse)
        callback(null, bolVendorInUse)
    });
}
// fetch all
const changeCurrentCollection = (collectionName, callback) => {
    Models.CurrentVendor.findOneAndUpdate({ seedId: 11 }, { $set: { seedId: 11, collectionName } }, { upsert: true, new: true }, (e, r) => {
        console.log("CURRENT VENDOR IN USE: e,r: ", e, r)
        if (e) {
            return callback(e)
        }
        bolVendorInUse = collectionName;
        callback(null, r)
    });
}
const findAll = (criteria, projection = {}, options = null, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        const query = Models.DynamicBolVendor(currentCollectionName).find(criteria, projection);
        if (options) {
            const { offset = 0, limit, sort = null } = options;
            if (sort) {
                query.sort(sort);
            }
            if (limit) {
                query.skip(offset);
                query.limit(limit);
            }
        }
        query.lean().exec(callback);
    })
};

// fetch one
const findOne = (criteria, projection, options = {}, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName)
            .findOne(criteria, projection, options, callback);
    })
}

// fetch count
const count = (criteria, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName)
            .countDocuments(criteria, callback);
    })
}

// create
const create = (objToSave, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        new Models.DynamicBolVendor(currentCollectionName)(objToSave)
            .save(callback);
    })
}

const createMany = (objToSave, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName).insertMany(objToSave, { ordered: false }, callback);
    })
};
// Update
const update = (criteria, dataToSet, options, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName).findOneAndUpdate(criteria, dataToSet, options, callback);
    })
};
const deleteOne = (criteria, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName).deleteOne(criteria, callback)
    })
};

const deleteMany = (criteria, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName).deleteMany(criteria, callback);
    })
};
const updateOne = (criteria, dataToSet, options, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName).updateOne(criteria, dataToSet, options, callback);
    })
};
const updateAll = (criteria, dataToSet, options, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicBolVendor(currentCollectionName).updateMany(criteria, dataToSet, options, callback);
    })
};
const updateOneByCollectionName = (currentCollectionName, criteria, dataToSet, options, callback) => Models.DynamicBolVendor(currentCollectionName)
    .updateOne(criteria, dataToSet, options, callback);
const updateAllByCollectionName = (currentCollectionName, criteria, dataToSet, options, callback) => {
    Models.DynamicBolVendor(currentCollectionName).updateMany(criteria, dataToSet, options, callback);
};
const findOneByCollectionName = (currentCollectionName, criteria, projection, options = {}, callback) => Models.DynamicBolVendor(currentCollectionName)
    .findOne(criteria, projection, options, callback);
const syncIndex = (currentCollectionName, callback) => Models.DynamicBolVendor(currentCollectionName).syncIndexes(callback);
module.exports = {
    findAll,
    findOne,
    update,
    create,
    count,
    deleteOne,
    createMany,
    deleteMany,
    updateAll,
    updateOne,
    syncIndex,
    updateOneByCollectionName,
    updateAllByCollectionName,
    changeCurrentCollection,
    findOneByCollectionName,
    currentVendorInuse
};
