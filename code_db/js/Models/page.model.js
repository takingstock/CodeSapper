const mongoose = require('mongoose');
const config = require('config');

const { Schema, model } = mongoose;
const { ObjectId } = Schema;
const REF_DOCUMENT_MODEL = config.get('SCHEMA.DOCUMENTS');
const REF_IDP_MODEL = config.get('SCHEMA.IDP');

const TabularSchema = new Schema({
  cell_info: {
    type: Array,
    default: [],
  },
  cell_info_metadata: {
    type: Schema.Types.Mixed,
    default: []
  },
  hdr_row_metadata: {
    type: Schema.Types.Mixed,
    default: []
  },
  table_points: {
    type: Array,
    default: [],
  },
  column_vector: {
    type: Array,
    default: [],
  },
  row_vector: {
    type: Array,
    default: [],
  },
  hdr_row: {
    type: Array,
    default: [],
  },
  tbl_x0: {
    type: Number,
    default: null,
  },
  tbl_y0: {
    type: Number,
    default: null,
  },
  tbl_x2: {
    type: Number,
    default: null,
  },
  tbl_y2: {
    type: Number,
    default: null,
  },
  qc_error_type: {
    type: String,
    enum: [null, 'MISSING_TABLE', 'EXTRA_ROW', 'EXTRA_TABLE', 'EXTRA_COLUMN', 'MISSING_ROW', 'MISSING_COLUMN', 'MISSING_CELL', 'EXTRA_CELL', 'INCORRECT_HEADER'],
    default: null
  },
  table_id: {
    type: String,
    default: null
  },
  column_match: { type: Schema.Types.Mixed, default: {} },
  column_mapping: { type: Schema.Types.Mixed, default: [] }
})
const NonTabularSchema = new Schema({
  fieldId: {
    type: ObjectId,
    required: true,
  },
  confidence_score: {
    type: Number,
    default: 0,
  },
  confidence_threshold: {
    type: Number,
    default: 0,
  },
  global_key: {
    type: String,
    default: null,
  },
  data_type: {
    type: String,
    default: null,
  },
  mandatory: {
    type: Boolean,
    default: false,
  },
  recon: {
    type: Boolean,
    default: null,
  },
  local_key: {
    type: {
      edited_key: {
        type: String,
        default: null,
      },
      text: {
        type: String,
        default: null,
      },
      pts: {
        type: Array,
        default: [],
      },
      ocr_pts: {
        type: Array,
        default: [],
      },
    },
  },
  local_value: {
    type: {
      edited_value: {
        type: String,
        default: null,
      },
      text: {
        type: String,
        default: null,
      },
      pts: {
        type: Array,
        default: [],
      },
      ocr_pts: {
        type: Array,
        default: [],
      },
    },
  },
  value_raw_ocr: { type: String, default: null },
  feedback_applied: { type: Boolean, default: false },
  qc_error_type: {
    type: String,
    enum: [null, "CHARACTER", "VALUE", "DUPLICATE", "NONE"],
    default: null
  },
  order: {
    type: Number,
    default: 0
  }
});

const page = new Schema({
  pageId: {
    type: ObjectId,
    required: true,
  },
  documentId: {
    type: ObjectId,
    required: true,
    ref: REF_DOCUMENT_MODEL
  },
  tenantId: {
    type: ObjectId,
    required: true,
    ref: 'Tenant'
  },
  idpId: {
    type: ObjectId,
    required: true,
    ref: REF_IDP_MODEL
  },
  fileName: {
    type: String,
    required: true
  },
  pageNo: {
    type: Number,
    default: 1,
  },
  reviewed: {
    type: Boolean,
    default: false,
  },
  isFinalized: {
    type: Boolean,
    default: false,
  },
  isTabularFeedbackApplied: {
    type: Boolean,
    default: false,
  },
  isNonTabularFeedbackApplied: {
    type: Boolean,
    default: false,
  },
  isTabularFeedbackRequested: {
    type: Boolean,
    default: false,
  },
  isNonTabularFeedbackRequested: {
    type: Boolean,
    default: false,
  },
  ocr_link: {
    type: String,
    default: null,
  },
  ocr_output_link: {
    type: String,
    default: null,
  },
  all_kvp_path: {
    type: String,
    default: null,
  },
  pageImageLink: {
    type: String,
    default: null,
  },
  time_conv_ocr: {
    type: Number,
    default: 0,
  },
  time_kvp: {
    type: Number,
    default: 0,
  },
  time_table: {
    type: Number,
    default: 0,
  },
  dimension: {
    type: {
      height: {
        type: Number,
        default: null,
      },
      width: {
        type: Number,
        default: null,
      },
    },
    default: null,
  },
  isTableFlag: {
    type: Boolean,
    default: false,
  },
  isNonTableFlag: {
    type: Boolean,
    default: false,
  },
  tabularContentOriginal: Schema.Types.Mixed,
  tabularContent: {
    type: [TabularSchema],
    default: []
  },
  nonTabularContent: {
    type: [NonTabularSchema],
    default: [],
  },
  qrDetected: {
    type: Boolean,
    default: false,
  },
  qrContent: {
    default: null,
    type: {
      extractedData: {
        type: Schema.Types.Mixed,
        default: null,
      },
      qr: {
        type: String,
        default: null,
      },
    },
  },
  s3_path_ocr: {
    type: String,
    default: null
  },
  s3_path_ocr_stitched: {
    type: String,
    default: null
  },
  s3_ind_pdf_path: {
    type: String,
    default: null
  },
  s3_thumbnail_path: {
    type: String,
    default: null
  },
  page_type: {
    type: String,
    default: null
  },
  ai_page_type: {
    type: String,
    default: null
  },
  rotateByDegree: {
    type: Number,
    default: 0
  },
  sumRotateByDegree: {
    type: Number,
    default: 0
  },
  fileOriginalName: {
    type: String,
    default: null
  },
  disallow_snippet_flag: {
    type: Boolean,
    default: false
  },
  disallow_kvp_flag: {
    type: Boolean,
    default: false
  },
  ocrStrategyChanged: {
    type: Boolean,
    default: false
  },
  ocrStrategy: {
    type: [String],
    default: []
  },
}, { timestamps: true });
page.index({ documentId: 1 });
page.index({ pageId: 1 })
page.index({ idpId: 1 })
module.exports = model('page', page);
