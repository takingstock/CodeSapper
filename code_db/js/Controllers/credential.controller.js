const config = require('config');

const { credentialService } = require('../Services');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

const createCredentials = (
  { tenantId },
  payload,
  hcb,
) => {
  const criteria = { tenantId };
  const { zoho_table: zohoTable = null } = payload;
  if (zohoTable) {
    const dataToUpdate = {
      zoho_table: zohoTable,
      updatedAt: new Date(),
    };
    credentialService.update(
      { ...criteria },
      { $set: dataToUpdate },
      {
        new: true,
        upsert: true,
        projection: {
          createdBy: 0, updatedBy: 0, isDeleted: 0, deletedBy: 0,
        },
      },
      (err, response) => {
        if (err) {
          return hcb(err);
        }
        return hcb(null, {
          data: response,
          message: 'Saved Succesfully',
        });
      },
    );
  }
  return hcb(null, {
    data: null,
    message: 'Saved Succesfully',
  });
};

const updateCredentials = (
  _,
  { id: credId },
  payload,
  hcb,
) => {
  const criteria = { _id: credId };
  credentialService.update(
    { ...criteria },
    { $set: payload },
    {
      new: true,
      upsert: true,
      projection: {
        createdBy: 0, updatedBy: 0, isDeleted: 0, deletedBy: 0,
      },
    },
    (err, response) => {
      if (err) {
        return hcb(err);
      }
      return hcb(null, {
        data: response,
        message: 'Updated Succesfully',
      });
    },
  );
};

const fetchCredentials = (_, { tenantId, cred_type: credType }, hcb) => {
  let criteria = {
    isDeleted: false,
  };
  if (tenantId) {
    criteria = { ...criteria, tenantId };
  }
  const projection = {
    createdBy: 0, updatedBy: 0, isDeleted: 0, deletedBy: 0,
  };
  credentialService.findOne(criteria, projection, (err, response) => {
    if (err) {
      return hcb(err);
    }
    if (!response) {
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: null,
      });
    }
    if (!credType) {
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: response,
      });
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: {
        [credType]: response[credType],
      },
      message: 'Fetched Succesfully',
    });
  });
};

const deleteCredentials = ({ tenantId, id }, { recordIds }, hcb) => {
  const criteria = {
    _id: {
      $in: recordIds,
    },
    tenantId,
  };
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
  };

  credentialService.updateAll(
    criteria,
    { $set: dataToSet },
    {},
    (err) => {
      if (err) {
        return hcb(err);
      }
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
      });
    },
  );
};

module.exports = {
  createCredentials,
  updateCredentials,
  fetchCredentials,
  deleteCredentials,
};
