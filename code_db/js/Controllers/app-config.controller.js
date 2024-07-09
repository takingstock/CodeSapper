const config = require('config');
const { auto } = require('async');
const { appConfigService } = require('../Services');
const { createMongooseId } = require('../Utils/universal-functions.util');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const CONFIG_SETTING_TYPES = config.get('CONFIG_SETTING_TYPES');

// /**
//  * merge enterprise config with user config
//  * @param {Object} defaultUploadTypes
//  * @param {Object} uploadTypes
//  * @param {String} key
//  * @returns
//  */
// const _mergeDocConfigurations = (
// defaultUploadTypes,
// uploadTypes, key = 'customAliases') => defaultUploadTypes
//   .map((uploadType) => {
//     let uploadTypeCopy = { ...uploadType };
//     const enterpriseType = uploadTypes.find((item) => uploadTypeCopy.slug === item.slug) || {};
//     const { mapping = {}, apis = {} } = enterpriseType;
//     const { mapping: apiMapping = null } = apis || {};
//     if (mapping[key] && mapping[key].length) {
//       uploadTypeCopy = {
//         ...uploadTypeCopy,
//         mapping: {
//           ...uploadTypeCopy.mapping, [key]: mapping[key],
//         },
//       };
//     }
//     if (apiMapping) {
//       uploadTypeCopy = {
//         ...uploadTypeCopy,
//         apis: {
//           ...uploadTypeCopy.apis || {},
//           mapping: apiMapping,
//         },
//       };
//     }
//     return uploadTypeCopy;
//   });

// /**
//  * merge enterprise config with user config
//  * @param {Object} defaultApiTypes
//  * @param {Object} customApiTypes
//  * @param {String} key
//  * @returns
//  */
// const _mergeApiConfigurations = (defaultUploadTypes, customApiTypes) => defaultUploadTypes
//   .map((uploadType) => {
//     const { apis = {} } = uploadType;
//     const { defaultApis = [] } = apis || {};
//     defaultApis.forEach((item) => {
//       const userCustomObject = customApiTypes.find(
//         (customItem) => customItem.type === uploadType.slug,
//       ) || {};

//       if (userCustomObject && userCustomObject.apiSlug === item.slug) {
//         apis.mapping = userCustomObject;
//       }
//     });
//     return {
//       ...uploadType,
//       apis,
//     };
//   });

// /**
//  * merge enterprise config with user config
//  * @param {Object} defaultConfig
//  * @param {Object} customConfig
//  * @param {String} key
//  * @returns
//  */
// const _mergeConfigConfigurations = (defaultConfig, customConfig) => (
//   { ...Object.keys(customConfig).length ? customConfig : defaultConfig });

/**
 * fetch default config
 * @returns
 */
const _defaultConfig = (callback) => appConfigService.findOne(
  { type: CONFIG_SETTING_TYPES.GLOBAL },
  {
    createdBy: 0, updatedBy: 0, tenantId: 0, createdAt: 0, updatedAt: 0,
  },
  { lean: true },
  null,
  callback
);

/**
 * fetch all configs
 * @param {object} userInfo
 * @param {object} browserInfo
 * @returns
 */
const configFetch = (
  { tenantId = null },
  {
    fields = null, q = '', limit = 10, offset = 0, sortBy = 'createdAt', orderBy = 'DESC',
  },
  { 'user-agent': userAgent, ip },
  hcb,
) => {
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  let criteria = {
    isDeleted: false,
    tenantId: createMongooseId(tenantId),
    type: CONFIG_SETTING_TYPES.ENTERPRISE,
  };
  let projection = {
    createdBy: 0, updatedBy: 0, tenantId: 0, updatedAt: 0,
  };
  if (fields) {
    // eslint-disable-next-line no-param-reassign
    limit = 0;
    // eslint-disable-next-line no-param-reassign
    offset = 0;
    const fieldsArray = fields.split(',');
    if (fields.length) {
      projection = {};
      fieldsArray.forEach((field) => {
        projection[field] = 1;
      });
    }
  }
  if (q) {
    criteria = {
      ...criteria,
      name: { $regex: q, $options: 'i' },
    };
  }
  auto({
    configs: (cb) => {
      appConfigService.findAllByAggregation(
        criteria,
        projection,
        [],
        sortObj,
        offset,
        limit,
        (err, response) => {
          if (err) {
            return cb(err);
          }
          const { dataList = [], count } = response[0];
          const totalCount = count[0] && count[0].count ? count[0].count : 0;
          const mappedConfig = dataList.map((dataItem) => {
            let mappedItem = {};
            const {
              name, type,
              config: customConfig = {},
              userConfig = {}, _id,
              inputType,
              country,
              outputType,
            } = dataItem;
            if (!fields) {
              if (userConfig && userConfig?.platform) {
                userConfig.platform = {
                  ip,
                  userAgent,
                };
              }
              mappedItem = {
                ...mappedItem,
                _id,
                type,
                name,
                inputType,
                country,
                outputType,
                config: customConfig,
                ...userConfig,
              };
              return mappedItem;
            }
            return {
              _id, name,
            };
          });
          return cb(null, {
            mappedConfig,
            totalCount,
          });
        },
      );
    },
    defaultConfig: ['configs', (results, cb) => {
      const { mappedConfig, totalCount } = results.configs;
      if (!fields) {
        _defaultConfig((error, defaultConfig) => {
          if (!defaultConfig?.platform) {
            // eslint-disable-next-line no-param-reassign
            defaultConfig = {
              ...defaultConfig,
              platform: {
                ip,
                userAgent,
              }
            };
          }
          cb(null, {
            ...HTTP_SUCCESS_MESSAGES.DEFAULT,
            data: {
              enterprise: {
                list: mappedConfig,
                totalCount,
              },
              global: defaultConfig,
            }
          });
        });
      } else {
        cb(null, {
          ...HTTP_SUCCESS_MESSAGES.DEFAULT,
          data: {
            enterprise: {
              list: mappedConfig,
              totalCount,
            },
          },
        });
      }
    },
    ],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.defaultConfig);
  });
};

/**
 * fetch individual config details
 * @param {object} userInfo
 * @param {object} queryParams
 * @param {object} browserInfo
 * @returns
 */
const configFetchDetail = async (
  __,
  { id: configId },
  { 'user-agent': userAgent, ip },
  hcb,
) => {
  appConfigService.findOne(
    { _id: configId, type: CONFIG_SETTING_TYPES.ENTERPRISE, isDeleted: false },
    {
      createdBy: 0, updatedBy: 0, tenantId: 0, createdAt: 0, updatedAt: 0,
    },
    (err, result) => {
      if (err) {
        return hcb(err);
      }
      let enterpriseConfig = { ...result };
      const {
        name, config: customConfig, userConfig = {}, inputType, country, outputType, _id,
      } = enterpriseConfig || {};
      const enhancedConfig = {
        name, inputType, country, outputType, _id, config: customConfig,
      };
      if (!userConfig.platform) {
        userConfig.platform = {
          ip,
          userAgent,
        };
      }
      enterpriseConfig = {
        ...enhancedConfig,
        ...userConfig,
      };
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: enterpriseConfig,
      });
    },
  );
};

/**
 * create new config
 * @param {object} userInfo
 * @param {object} payload
 * @param {object} queryParams
 * @returns
 */
const configCreate = (
  { id, tenantId = null },
  {
    name = null,
    inputType = null,
    country = null, upload = [], verification = [], outputType, platform = null, outputApi = null,
  },
  { 'user-agent': userAgent, ip },
  hcb,
) => {
  let dataToSave = {
    createdBy: id,
    name,
    outputType,
    type: CONFIG_SETTING_TYPES.ENTERPRISE,
    tenantId,
    userConfig: {
      upload: null,
      verification: null,
      platform: null,
    },
  };
  if (inputType) {
    dataToSave.inputType = inputType;
  }
  if (country) {
    dataToSave.country = country;
  }
  if (upload) {
    dataToSave.userConfig = {
      ...dataToSave.userConfig,
      upload,
    };
  }
  if (verification) {
    dataToSave.userConfig = {
      ...dataToSave.userConfig,
      verification,
    };
  }
  if (platform) {
    dataToSave.userConfig = {
      ...dataToSave.userConfig,
      platform,
    };
  }
  if (outputApi) {
    dataToSave = {
      ...dataToSave,
      config: {
        outputApi: {
          setting: outputApi,
        },
      },
    };
  }

  appConfigService.create(dataToSave, (err, response) => {
    if (err) {
      return hcb(err);
    }
    const {
      name: configName, type, config: customConfig = {},
      userConfig = {}, _id, inputType: inputTypeAlias,
      country: countryAlias, outputType: outputTypeAlias,
    } = response || {};
    if (!userConfig.platform) {
      userConfig.platform = {
        ip,
        userAgent,
      };
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.CREATED,
      data: {
        _id,
        name: configName,
        type,
        inputType: inputTypeAlias,
        country: countryAlias,
        outputType: outputTypeAlias,
        config: customConfig,
        ...userConfig,
      },
    });
  });
};

/**
 * create new config
 * update the enterprise configuration
 * @param {object} userInfo
 * @param {object} payload
 * @param {object} params
 * @param {string} query
 * @returns
 */
const configUpdate = (
  { id, tenantId = null },
  {
    name,
    country = null,
    inputType = null,
    upload = [], verification = [], outputType = null, platform = null, outputApi = null,
  },
  { id: configId },
  { 'user-agent': userAgent, ip },
  hcb,
) => {
  auto({
    config: (cb) => {
      appConfigService.findOne({
        _id: configId,
        tenantId,
      }, (err, response) => {
        if (err) {
          return cb(err);
        }
        return cb(null, response || {});
      });
    },
    updateConfig: ['config', (results, cb) => {
      if (!results.config) {
        return cb(new Error('Config not found'));
      }
      const { config: customConfig = {} } = results.config;
      let dataToUpdate = {
        updatedBy: id,
        name,
        outputType,
        type: CONFIG_SETTING_TYPES.ENTERPRISE,
        tenantId,
        userConfig: {
          upload: null,
          verification: null,
          platform: null,
        },
      };
      if (inputType) {
        dataToUpdate.inputType = inputType;
      }
      if (country) {
        dataToUpdate.country = country;
      }
      if (upload) {
        dataToUpdate.userConfig = {
          ...dataToUpdate.userConfig,
          upload,
        };
      }
      if (verification) {
        dataToUpdate.userConfig = {
          ...dataToUpdate.userConfig,
          verification,
        };
      }
      if (platform) {
        dataToUpdate.userConfig = {
          ...dataToUpdate.userConfig,
          platform,
        };
      }
      if (outputApi) {
        dataToUpdate = {
          ...dataToUpdate,
          config: {
            ...customConfig,
            outputApi: {
              ...(customConfig.outputApi || {}),
              setting: outputApi,
            },
          },
        };
      }
      appConfigService.update({ _id: configId, tenantId }, dataToUpdate, (err, response) => {
        if (err) {
          return cb(err);
        }
        const {
          name: configName, type, config: configAlias = {},
          userConfig: userConfigAlias = {}, _id, inputType: inputTypeAlias,
          country: countryAlias, outputType: outputTypeAlias,
        } = response || {};
        if (!userConfigAlias.platform) {
          userConfigAlias.platform = {
            ip,
            userAgent,
          };
        }
        return cb(null, {
          ...HTTP_SUCCESS_MESSAGES.UPDATED,
          data: {
            _id,
            name: configName,
            country: countryAlias,
            type,
            inputType: inputTypeAlias,
            outputType: outputTypeAlias,
            config: configAlias,
            ...userConfigAlias,
          },
        });
      });
    }],
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, results.updateConfig);
  });
};

/**
 * config delete
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const configDelete = ({ id }, { recordIds }, hcb) => {
  const criteria = {
    type: CONFIG_SETTING_TYPES.ENTERPRISE,
    _id: {
      $in: recordIds,
    },
  };
  const dataToSet = {
    isDeleted: true,
    deletedBy: id,
  };
  appConfigService.updateAll(criteria, { $set: dataToSet }, {}, (err) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DELETE_SUCCESS,
    });
  });
};

module.exports = {
  configFetch,
  configFetchDetail,
  configUpdate,
  configCreate,
  configDelete,
};
