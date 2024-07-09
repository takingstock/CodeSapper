const config = require('config');
const { eachSeries, auto } = require("async")
const CELL_INFO_META = require("../Models/cellinfoMetaData.model")
const CELL_INFO_META_HISTORY = require("../Models/cellinfoMetaDataHistory.model")

const { createNewMongooseId, normalisedCoordinates } = require('../Utils/universal-functions.util');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');

const AI_STATUS = config.get('AI_STATUS');

const _findPage = (arr = [], pageNo) => arr.filter((item) => item.page === pageNo);

const _manipulateOcrPage = (
  arr = [],
  dimension = {},
) => arr.map((item) => ({
  confidence_score: (typeof (item.confidence) !== 'string' ? item.confidence : 0) || 0,
  confidence_threshold: item.confidence_threshold,
  fieldId: createNewMongooseId(),
  global_key: item.key || '',
  data_type: item.type || '',
  mandatory: item.mandatory || false,
  recon: typeof (item.recon) === 'boolean' ? item.recon : null,
  local_key: {
    edited_key: null,
    text: item.local_key || '',
    pts: item.pts_key || [],
    polarised_pts: normalisedCoordinates(item.pts_key, dimension) || [],
    ocr_pts: item.pts_key || [],
  },
  local_value: {
    edited_value: null,
    text: item.value || '',
    pts: item.pts_value || [],
    polarised_pts: normalisedCoordinates(item.pts_value, dimension) || [],
    ocr_pts: item.pts_value || [],
  },
  order: item.order,
  value_raw_ocr: item.value_raw_ocr,
  feedback_applied: item.feedback_applied
}));

const saveCellInfoMetaData = (data) => {
  eachSeries(data, (d, ecb) => {
    auto({
      backupInfo: (cb) => {
        CELL_INFO_META_HISTORY.create(d, cb)
      },
      info: (cb) => {
        CELL_INFO_META.create(d, cb)
      },
    }, ecb)
  }, (e) => {
    if (e) {
      console.log("eeeeeeeeeeeee saveCellInfoMetaData: ", e)
    }
  })
}
/**
 * Customize multiple tables
 * @param {*} tableData
 * @returns
 */
const _customizeTableData = (tables, pageNo, pageId) => {
  const mappedTables = []
  const cellInfoMetadata = []
  tables.forEach((tableContent) => {
    const {
      cell_info = [],
      cell_info_metadata,
      hdr_row_metadata,
      table_points,
      column_vector,
      row_vector,
      tbl_x0: x0 = null,
      tbl_y0: y0 = null,
      tbl_x2: x2 = null,
      tbl_y2: y2 = null,
      hdr_row = null,
      page = null,
      table_id,
      column_match
    } = tableContent;
    if (page === pageNo) {
      const cellInfo = Array.isArray(cell_info) ? cell_info : []
      // cellInfoMetadata.push({ pageId, cell_info_metadata }) // removed now as pageArray seperated
      mappedTables.push({
        cell_info: cellInfo,
        cell_info_metadata,
        hdr_row_metadata,
        table_points: table_points || [],
        column_vector,
        row_vector,
        hdr_row,
        tbl_x0: x0,
        tbl_y0: y0,
        tbl_x2: x2,
        tbl_y2: y2,
        table_id,
        column_match
      })
    }
  })
  // console.log("cellInfoMetadatacellInfoMetadatacellInfoMetadatacellInfoMetadata: ", cellInfoMetadata)
  // saveCellInfoMetaData(cellInfoMetadata) // run in background
  return mappedTables
}

/**
 * Depricated used before to handle single table
 * @param {*} tableContent
 * @returns
 */
// eslint-disable-next-line no-unused-vars
const _customizeTableDataOld = (tableContent) => {
  const {
    cell_info = {},
    table_points: tablePoints,
    column_vector: columnVector,
    row_vector: rowVector,
    tbl_x0: x0 = null,
    tbl_y0: y0 = null,
    tbl_x2: x2 = null,
    tbl_y2: y2 = null,
    hdr_row = null,
  } = tableContent;

  const mappedOnlyKeys = [];
  const mappedArray = Object.keys(cell_info).map((item, index) => {
    const row = cell_info[item] || {};
    if (index > 0) {
      const keysMapped = Object.keys(row).map((key) => ({
        key,
        pts: row[key].pts || [],
        text: row[key].text || '',
        column: row[key].column || '',
        local_column: row[key].local_column || ''
      }));
      return mappedOnlyKeys.map((key) => keysMapped.find((obj) => obj.key === key));
    }
    return Object.keys(row).map((key) => {
      mappedOnlyKeys.push(key);
      return {
        key,
        pts: row[key].pts || [],
        text: row[key].text || '',
      };
    });
  });
  return {
    data: mappedArray,
    tableBoundaries: tablePoints || [],
    columnVector,
    rowVector,
    hdr_row,
    tbl_x0: x0,
    tbl_y0: y0,
    tbl_x2: x2,
    tbl_y2: y2,
  };
};

// customize OCR response
const _customizeOcrResponse = (data, fileOriginalName = null) => {
  const finalProcessResponse = Array.isArray(data)
    ? data[0] : data;
  let aiOcrResponse = {};
  let docTotalPages = 0
  /* eslint-disable prefer-const */
  let {
    ai_unique_id: aiUniqueId,
    workflow_documents: workflowDocs = [],
    page_array: pageArray,
    non_table_content: nonTabularContent = [],
    table_content: tabularContent = [],
    type_of_document: docType = null,
    table_flag: isTableFlag = false,
    non_table_flag: isNonTableFlag = false,
    confidence_score_document: confidence = 0,
    qr_content: qrExtractedData = null,
    time_extract: ocrTimeExtract = 0,
    page_range: pageRange = [],
    s3_document_pdf_link: s3DocumentPdfLink = '',
    s3_ocr_path_output,
    address_id: addressId,
    flag_vendor_exist: flagVendorExists,
    table_columns,
    flag_3_5,
    header_table,
    table_thresholds,
    table_datatypes,
    doc_id,
    feedback_column_dict,
    all_time_list,
    document_metadata = {}
  } = finalProcessResponse;
  if (flagVendorExists === false) {
    flagVendorExists = false
  } else {
    flagVendorExists = true
  }
  nonTabularContent.forEach((e, index) => {
    e.order = index + 1;
  })

  if (!aiUniqueId || (data.error && data.error === 'OUTPUT_FAILURE')) {
    return {
      aiStatus: AI_STATUS.OCR_FAILED,
      pageArray: [],
      confidenceScore: 0,
      isTableFlag: false,
      isNonTableFlag: false,
      docType: null,
      corruptFile: data.corruptFile || false,
      pageRange: pageRange.join(),
      s3DocumentPdfLink
    };
  }
  let disallow_kvp_flag;
  let disallow_snippet_flag;
  /* eslint-disable camelcase */
  const cellInfoMetaData = []
  const mappedPageArray = pageArray && pageArray
    .map(({
      ocr_path: ocrPath,
      ocr_path_output: ocrPathOutput = null, dimension = {}, s3_path: s3Link, s3_path_ocr, time_extract, page_type, ...remainResponse
    }, index) => {
      docTotalPages++
      let page = _findPage(nonTabularContent || [], index);
      if (index === 0) {
        page.push(..._findPage(nonTabularContent || [], -1));
      }
      aiOcrResponse = {
        ...aiOcrResponse,
        isTableFlag,
        isNonTableFlag,
        docType,
      };
      const fileDetails = {}
      if (fileOriginalName) {
        fileDetails.fileOriginalName = fileOriginalName
      }
      ocrTimeExtract += (time_extract || 0) // add from each page
      const pageId = createNewMongooseId()
      if (remainResponse.disallow_kvp_flag) {
        disallow_kvp_flag = true
      }
      if (remainResponse.disallow_snippet_flag) {
        disallow_snippet_flag = true
      }
      return {
        ...remainResponse,
        reviewed: false,
        isFinalized: false,
        isTabularFeedbackRequested: false,
        isTabularFeedbackApplied: false,
        isNonTabularFeedbackRequested: false,
        isNonTabularFeedbackApplied: false,
        pageId,
        ocr_link: ocrPath,
        ocr_output_link: ocrPathOutput,
        pageImageLink: s3Link,
        pageNo: index + 1,
        dimension,
        tabularContent: _customizeTableData(tabularContent, index, pageId),
        nonTabularContent: _manipulateOcrPage(page, dimension),
        qrDetected: !!(qrExtractedData && Object.keys(qrExtractedData).length),
        qrContent: {
          extractedData: qrExtractedData,
          qr: null,
        },
        s3_path_ocr,
        page_type,
        ai_page_type: page_type,
        ...fileDetails
      };
    });

  let pageEnd = 0

  pageRange.forEach(p => {
    if (pageEnd < p) {
      pageEnd = p
    }
  })
  aiOcrResponse = {
    ...aiOcrResponse,
    aiUniqueId,
    aiStatus: AI_STATUS.OCR_DONE,
    pageArray: mappedPageArray || [],
    workflowDocs,
    confidenceScore: (typeof (confidence) !== 'string' ? confidence : 0) || 0,
    ocrTimeExtract,
    pageRange: pageRange.join(),
    pageEnd,
    s3DocumentPdfLink,
    s3_ocr_path_output,
    addressId,
    aiDocType: docType,
    flagVendorExists,
    table_columns,
    flag_3_5,
    header_table,
    docTotalPages,
    table_thresholds,
    table_datatypes,
    feedback_column_dict,
    all_time_list,
    document_metadata
  };

  if (disallow_kvp_flag || disallow_snippet_flag) {
    process.env.DISALLOW_KVP = "DISABLED"
    const b = {
      apiTarget: 'OCR',
      disallow_kvp_flag,
      disallow_snippet_flag,
      aiUniqueId,
      s3_ocr_path_output,
      fileOriginalName,
      doc_id
    }
    process.emit("DISALLOW_FLAG", { data: b, from: "OCR HELPER" })
    ImcAPIEndPoints.sendEmail({
      subject: 'OCR | DISALLOW FLAG',
      body: JSON.stringify(b),
      apiTarget: 'OCR'
    }).then(() => {
      console.log("EMAIL SENT")
    }).catch((e) => {
      console.log("EMAIL FAILED TO SENT", e)
    });
  }
  return aiOcrResponse;
};
const _customizeOcrResponseMultiPage = (data, fileOriginalName) => {
  if (Array.isArray(data)) {
    return data.map(aidoc => _customizeOcrResponse(aidoc, fileOriginalName))
  }
  return [_customizeOcrResponse(data, fileOriginalName)]
}
module.exports = {
  _customizeOcrResponse,
  _customizeTableData,
  _customizeOcrResponseMultiPage
};
