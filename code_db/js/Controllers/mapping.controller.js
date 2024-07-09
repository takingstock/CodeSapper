// const config = require('config');
const { appConfigService } = require('../Services');

// const SUPPORTED_DOCS = config.get('DOCS');
// const CONFIG_TYPES = config.get('CONFIG_TYPE');

// const _ = require('lodash');

/**
 * - enterprise selected mapping
 * @param {String} tenantId
 * @param {String} configId
 * @param {Object} inputSource
 * @returns
 */
const _fetchUserMapping = async (configId, inputSource) => {
  if (!configId) {
    return { customAliases: [] };
  }
  const criteria = {
    _id: configId,
  };
  const { _id, userConfig = {} } = await appConfigService.findOne(
    criteria, {},
  ) || {};
  const {
    upload = [],
  } = userConfig || {};
  const { aliases = [] } = upload.find((item) => item.type === inputSource.type) || {};
  return { _id, customAliases: aliases };
};

/**
 * - default mapping
 * @param {Object} inputSource
 * @returns
 */
const _fetchDefaultMapping = async (inputSource, type) => {
  const criteria = { type: 'global' };
  const projection = {};
  const { _id, uploadTypes = [] } = await appConfigService.findOne(
    criteria, projection, { lean: true },
  ) || {};
  const { mapping } = uploadTypes.find((item) => item.slug === type) || {};
  const { defaultFields = [], ocrAliases = [] } = mapping || {};
  return {
    _id,
    defaultFields: defaultFields.map((item) => item.key),
    ocrAliases,
  };
};

/**
 * mapped ocr response with the default mapping
 * @param {String} idpType
 * @param {Object} ocrData
 * @param {Array} aliases
 * @returns
 */
const _mappingWithOcrAliases = (idpType, ocrData = {}, aliases = []) => {
  if (!aliases.length) {
    return ocrData;
  }
  const mapping = {};
  Object.keys(ocrData).forEach((key) => {
    const alias = aliases.find((item) => item.alias === key);
    if (alias) {
      mapping[alias.key] = ocrData[key];
    }
  });
  mapping.type = idpType;
  return mapping;
};

/**
 * mapped ocr response with the enterprise mapping
 * @param {String} idpType
 * @param {Object} mappedData
 * @param {Array} aliases
 * @returns
 */
const _mappingWithUserAliases = (idpType, mappedData = {}, aliases = []) => {
  const mapping = {};
  Object.keys(mappedData).forEach((key) => {
    const field = aliases.find((item) => item.key === key);
    if (field) {
      mapping[field.alias] = mappedData[key];
    }
  });
  mapping.type = idpType;
  return mapping;
};

// const _mergeSimilarMapping = (mapping = []) => {
//   const aadharList = mapping.filter((item) => item.type === SUPPORTED_DOCS.AADHAAR);
//   const panList = mapping.filter((item) => item.type === SUPPORTED_DOCS.PAN);
//   const uniqueAadhar = _(aadharList)
//     .groupBy('aadhaar_no')
//     .map((g) => _.mergeWith({}, ...g, (obj, src) => (
// _.isArray(obj) ? obj.concat(src) : undefined)))
//     .value();
//   const uniquePan = _(panList)
//     .groupBy('pan_no')
//     .map((g) => _.mergeWith({}, ...g, (obj, src) =>
// (_.isArray(obj) ? obj.concat(src) : undefined)))
//     .value();
//   return [...uniqueAadhar, ...uniquePan];
// };

/**
 * map ocr response ert default or enterprise mapping
 * @param {Object} userInfo
 * @param {String} configId
 * @param {Array} mapping
 * @returns
 */
const mappingOcrFields = (configId, ocrResponse = {},
  // eslint-disable-next-line no-async-promise-executor
  document = {}) => new Promise(async (resolve) => {
  const { pageArray = [] } = ocrResponse;
  // create common mapping for all the pages
  const aiMappedData = {
    'Document name': document?.fileOriginalName,
    'Document size': document?.fileSize,
    'Document extension': document?.fileExtension,
    'Document type': ocrResponse?.docType || null,
    'AI status': ocrResponse?.aiStatus,
  };
    // generate mapping for each page
  let aiResponse = pageArray.map((item) => {
    const { nonTabularContent = [] } = item;
    nonTabularContent.forEach((field) => {
      aiMappedData[field.global_key] = field?.local_value?.text || '';
    });
    return aiMappedData;
  });
  if (!aiResponse.length) {
    aiResponse = [aiMappedData];
  }
  aiResponse = aiResponse.reduce((result, current) => Object.assign(result, current), {});

  // get default mapping
  const { ocrAliases } = await _fetchDefaultMapping(aiResponse, aiResponse.type);
  const mappedFields = _mappingWithOcrAliases(aiResponse.type, aiResponse, ocrAliases);
  const { customAliases } = await _fetchUserMapping(configId, aiResponse);
  // merge default and user mapping
  if (customAliases.length) {
    const customMappedFields = _mappingWithUserAliases(
      aiResponse.type, mappedFields, customAliases,
    );
    return resolve({ ...customMappedFields });
  }
  return resolve({ ...mappedFields });
});

module.exports = {
  mappingOcrFields,
};
