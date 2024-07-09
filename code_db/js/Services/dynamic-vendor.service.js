const config = require('config');
const mongoose = require('mongoose');
const Models = require('../Models');

const modelName = config.get('SCHEMA.VENDORS');

let vendorInUse = null;
const currentVendorInuse = (callback) => {
    if (vendorInUse) {
        return callback(null, vendorInUse)
    }
    Models.CurrentVendor.findOne({ seedId: 10 }, (e, r) => {
        console.log("CURRENT VENDOR IN USE: e,r: ", e, r)
        if (e) {
            return callback(e)
        }
        vendorInUse = (r && r.collectionName) || modelName
        console.log("CURRENT VENDOR IN USE: vendorInUse ", vendorInUse)
        callback(null, vendorInUse)
    });
}
// fetch all
const changeCurrentCollection = (collectionName, callback) => {
    Models.CurrentVendor.findOneAndUpdate({ seedId: 10 }, { $set: { seedId: 10, collectionName } }, { upsert: true, new: true }, (e, r) => {
        console.log("CURRENT VENDOR IN USE: e,r: ", e, r)
        if (e) {
            return callback(e)
        }
        vendorInUse = collectionName;
        callback(null, r)
    });
}
const findAll = (criteria, projection = {}, options = null, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        const query = Models.DynamicVendor(currentCollectionName).find(criteria, projection);
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
        Models.DynamicVendor(currentCollectionName)
            .findOne(criteria, projection, options, callback);
    })
}

// fetch count
const count = (criteria, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicVendor(currentCollectionName)
            .countDocuments(criteria, callback);
    })
}

// create
const create = (objToSave, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        new Models.DynamicVendor(currentCollectionName)(objToSave)
            .save(callback);
    })
}

const createMany = (objToSave, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicVendor(currentCollectionName).insertMany(objToSave, { ordered: false }, callback);
    })
};
// Update
const update = (criteria, dataToSet, options, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicVendor(currentCollectionName).findOneAndUpdate(criteria, dataToSet, options, callback);
    })
};
const deleteOne = (criteria, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicVendor(currentCollectionName).deleteOne(criteria, callback)
    })
};

const deleteMany = (criteria, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicVendor(currentCollectionName).deleteMany(criteria, callback);
    })
};
const updateOne = (criteria, dataToSet, options, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicVendor(currentCollectionName).updateOne(criteria, dataToSet, options, callback);
    })
};
const updateAll = (criteria, dataToSet, options, callback) => {
    currentVendorInuse((e, currentCollectionName) => {
        if (e) {
            return callback(e);
        }
        Models.DynamicVendor(currentCollectionName).updateMany(criteria, dataToSet, options, callback);
    })
};
const updateOneByCollectionName = (currentCollectionName, criteria, dataToSet, options, callback) => Models.DynamicVendor(currentCollectionName)
    .updateOne(criteria, dataToSet, options, callback);
const updateAllByCollectionName = (currentCollectionName, criteria, dataToSet, options, callback) => {
    Models.DynamicVendor(currentCollectionName).updateMany(criteria, dataToSet, options, callback);
};
const findOneByCollectionName = (currentCollectionName, criteria, projection, options = {}, callback) => Models.DynamicVendor(currentCollectionName)
    .findOne(criteria, projection, options, callback);
const syncIndex = (currentCollectionName, callback) => Models.DynamicVendor(currentCollectionName).syncIndexes(callback);
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
