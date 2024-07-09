const config = require('config');
const { createNewMongooseId, normalisedCoordinates } = require('../Utils/universal-functions.util');
const { _customizeTableData } = require('./ocr');

const AI_STATUS = config.get('AI_STATUS');

const __processKeyValueResponse = (response = [], aiStatus) => response.map((doc) => {
  const {
    processed_key_feedback: feedback = [],
    doc_id: documentId,
    table_flag: isTableFlag = false,
    non_table_flag: isNonTableFlag = false,
    dimension = {},
  } = doc;
  // [TODO]- need to consider local key & local_value as array
  // but currently frontend support only object
  const mappedData = feedback.map((item) => {
    const { local_key: key, local_value: value } = item;
    const usedKey = (Array.isArray(key) && key.length && key[0]) || key;
    const usedvalue = (Array.isArray(value) && value.length && value[0]) || value;
    const { pts: keyPts = [], text: keyText = '' } = usedKey;
    const { pts: valuePts = [], text: valueText = '' } = usedvalue;
    return {
      fieldId: createNewMongooseId(),
      global_key: item.global_key,
      // check as AI sending inconsistent data
      data_type: (typeof item.type !== 'object') ? item.type : '',
      mandatory: item.mandatory || false,
      confidence_score: item.confidence || 0,
      recon: typeof (item.recon) === 'boolean' ? item.recon : null,
      local_key: {
        edited_key: null,
        text: keyText,
        pts: keyPts,
        polarised_pts: normalisedCoordinates(keyPts, dimension),
        ocr_pts: keyPts,
        ...usedKey,
      },
      local_value: {
        edited_value: null,
        text: valueText,
        pts: valuePts,
        polarised_pts: normalisedCoordinates(valuePts, dimension),
        ocr_pts: valuePts,
      },
    };
  });
  return {
    documentId,
    isTableFlag,
    isNonTableFlag,
    confidenceScore: doc.confidence_score_document || 0,
    docType: doc.document_category || null,
    pageNo: doc.page_no || 1,
    ocrOutputPath: doc.ocr_output_path || null,
    aiStatus,
    nonTabularContent: mappedData.length ? mappedData : null,
  };
});

const __processTabularResponse = (response, aiStatus) => response.map((item) => {
  const {
    doc_id: docId,
    page_no: pageNo,
    table_content: feedbackTabularContent = [],
    document_category: docType,
    // [TODO] - Subject to change
    table_flag: isTableFlag = false,
    non_table_flag: isNonTableFlag = false,
    ocr_output_path: ocrOutputPath = null,
    confidence_score_document: confidenceScore = 0,
  } = item;
  let tabularContent = {};
  if (Array.isArray(feedbackTabularContent) && feedbackTabularContent.length) {
    const tabularObj = feedbackTabularContent;
    tabularContent = _customizeTableData(tabularObj);
  }
  return {
    ocrOutputPath,
    documentId: docId,
    docType,
    pageNo: parseInt(pageNo, 10),
    aiStatus,
    confidenceScore,
    // [TODO] - Subject to change
    isTableFlag,
    isNonTableFlag,
    tabularContent,
  };
});

// update documents as per the Non Tabular feedbcak
// received from the AI server
const _customizeNonTabularResponse = (
  resolvedArray = [],
  // [TODO] - will be updated as per upcoming frontend mockup
  failedArray = [],
) => [
    ...__processKeyValueResponse(resolvedArray, AI_STATUS.FEEDBACK_DONE),
    ...__processKeyValueResponse(failedArray, AI_STATUS.FEEDBACK_FAILED),
  ];

// update documents as per the Tabular-feedbcak
// received from the AI server
const _customizeTabularResponse = (
  resolvedArray = [],
  // [TODO] - will be updated as per upcoming frontend mockup
  failedArray = [],
) => [
    ...__processTabularResponse(resolvedArray, AI_STATUS.FEEDBACK_DONE),
    ...__processTabularResponse(failedArray, AI_STATUS.FEEDBACK_FAILED),

  ];

module.exports = {
  _customizeNonTabularResponse,
  _customizeTabularResponse,
};
