const Models = require('../Models');

const findOne = (criteria, projection = {}, options = {}, populateArray = null, cb) => {
  const query = Models.TrainingFeedback
    .findOne(criteria, projection, options);
  if (populateArray) {
    populateArray.forEach((item) => {
      query.populate({
        path: item.path,
        select: item.fields,
      });
    });
  }
  return query.lean().exec(cb);
};

const create = (objToSave, cb) => new Models.TrainingFeedback(objToSave).save(cb);

module.exports = {
  findOne,
  create,
};
