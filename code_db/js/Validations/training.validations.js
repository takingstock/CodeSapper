const Joi = require('joi');

Joi.objectId = require('joi-objectid')(Joi);

// training keys values delete
const TRAINING_KEY_VALUES_SCHEMA = Joi.object({
  fieldId: Joi.array().items(Joi.objectId().required()),
});

// training keys values delete
const TRAINING_KEY_VALUES_PARAMS_SCHEMA = Joi.object({
  id: Joi.objectId().required(),
  pageNo: Joi.number().required(),
});

// idp payload schema
const TRAINING_NON_TABULAR_SCHEMA = Joi.object({
  bucket_id: Joi.string().optional(),
  is_finalized: Joi.boolean().required().default(false),
  page_no: Joi.number().required(),
  doc_name: Joi.string().optional(),
  doc_type: Joi.string().optional(),
  isTablePresent: Joi.boolean().optional(),
  user_feedback: Joi.array()
    .items(
      Joi.object({
        fieldId: Joi.string().optional(),
        global_key: Joi.string().required(),
        data_type: Joi.string().required(),
        mandatory: Joi.boolean().required().default(false),
        recon: Joi.boolean().optional().default(false).allow(null),
        local_key: Joi.object({
          pts: Joi.array().items(
            Joi.number().integer().optional(),
          ),
          text: Joi.string().optional().allow(''),
          edited_key: Joi.string().optional().allow(null, ''),
        })
          .required(),
        local_value: Joi.object({
          pts: Joi.array().items(
            Joi.number().integer().optional(),
          ),
          text: Joi.string().optional().allow(''),
          edited_value: Joi.string().optional().allow(null, ''),
        })
          .required(),
        qc_error_type: Joi.string().allow('', null)
      }),
    ).default([]),
});

// idp payload schema
const TRAINING_TABULAR_SCHEMA = Joi.object({
  bucket_id: Joi.string().optional(),
  is_finalized: Joi.boolean().required().default(false),
  page_no: Joi.number().required(),
  doc_name: Joi.string().optional(),
  doc_type: Joi.string().optional(),
  summary: Joi.string().valid(
    'ROW_ADDED',
    'ROW_EDITED',
    'ROW_DELETED',
    'COLUMN_ADDED',
    'COLUMN_EDITED',
    'COLUMN_DELETED',
    'TABLE_ADDED',
    'TABLE_EDITED',
  ).required().allow(''),
  user_feedback: Joi.object({
    tableBoundaries: Joi.array().items(Joi.number()).optional(),
    row_vector_additions: Joi.array().items(Joi.number()).optional(),
    row_vector_removals: Joi.array().items(Joi.number()).optional(),
    column_vector_additions: Joi.array().items(Joi.number()).optional(),
    column_vector_removals: Joi.array().items(Joi.number()).optional(),
  }),
});

module.exports = {
  TRAINING_NON_TABULAR_SCHEMA,
  TRAINING_TABULAR_SCHEMA,
  TRAINING_KEY_VALUES_SCHEMA,
  TRAINING_KEY_VALUES_PARAMS_SCHEMA,
};
