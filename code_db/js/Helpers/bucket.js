const config = require('config');
const { eachSeries } = require('async');
const { documentService, idpService } = require('../Services');

const BUCKET_TYPES = config.get('BUCKET_TYPES');

const _blankBucketResponse = (type) => {
  let className = null;
  if (type === BUCKET_TYPES.NO_DETECTION) {
    className = 'class1';
  } else if (BUCKET_TYPES.KEY_VALUE_FAILURE) {
    className = 'class2';
  } else if (BUCKET_TYPES.NO_TABLE_DETECTION) {
    className = 'class3';
  }
  return [
    {
      count: 0,
      feedbackCount: 0,
      bucketId: className,
      name: type,
      buckets: [],
    },
  ];
};

const __calculateTotalFailedFiles = (bucket = {}) => {
  if (bucket.files) {
    return bucket.files.length;
  }
  let docs = 0;
  let trainingDocs = 0;
  if (bucket && Object.keys(bucket).length) {
    docs = Object.keys(bucket).map((item) => bucket[item].files.length)
      .reduce((a, sum) => sum + a, 0);
    trainingDocs = Object.keys(bucket).map((item) => bucket[item].training_set.length)
      .reduce((a, sum) => sum + a, 0);
  }
  return docs + trainingDocs;
};

const _customizeBucketResoonse = (bucketResponse = {}) => {
  let classesArray = [];
  Object.keys(bucketResponse).forEach((item) => {
    if (item === 'no_detection') {
      if (!Object.keys(bucketResponse[item]).length) {
        classesArray = [...classesArray, ..._blankBucketResponse(BUCKET_TYPES.NO_DETECTION)];
      } else {
        classesArray = [
          ...classesArray,
          {
            bucketId: 'class1',
            name: item === 'no_detection' ? BUCKET_TYPES.NO_DETECTION : BUCKET_TYPES.NO_DETECTION,
            count: __calculateTotalFailedFiles(bucketResponse[item]),
            buckets: Object.keys(bucketResponse[item]).map((item2) => ([
              ...bucketResponse[item][item2].files.map((file) => ({
                docCategory: item2,
                docId: (typeof file === 'string') ? file : (file.doc_id || null),
                ocrOutputPath: (typeof file === 'string') ? null : (file.ocr_output_path || null),
                isTrainingDoc: false,
                isFeedApplied: false,
              })),
              ...bucketResponse[item][item2].training_set.map((file) => ({
                docCategory: item2,
                docId: (typeof file === 'string') ? file : (file.doc_id || null),
                ocrOutputPath: (typeof file === 'string') ? null : (file.ocr_output_path || null),
                isFeedApplied: false,
                isTrainingDoc: true,
              })),
            ])).flat(),
          },
        ];
      }
    }
    if (item === 'partial_key_value_failures') {
      if (!Object.keys(bucketResponse[item]).length) {
        classesArray = [...classesArray, ..._blankBucketResponse(BUCKET_TYPES.KEY_VALUE_FAILURE)];
      } else {
        classesArray = [
          ...classesArray,
          {
            bucketId: 'class2',
            name: item === 'partial_key_value_failures' ? BUCKET_TYPES.KEY_VALUE_FAILURE : BUCKET_TYPES.KEY_VALUE_FAILURE,
            count: __calculateTotalFailedFiles(bucketResponse[item]),
            buckets: Object.keys(bucketResponse[item]).map((item2) => ([
              ...bucketResponse[item][item2].files.map((file) => ({
                docCategory: item2,
                docId: (typeof file === 'string') ? file : (file.doc_id || null),
                ocrOutputPath: (typeof file === 'string') ? null : (file.ocr_output_path || null),
                isTrainingDoc: false,
                isFeedApplied: false,
              })),
              ...bucketResponse[item][item2].training_set.map((file) => ({
                docCategory: item2,
                docId: (typeof file === 'string') ? file : (file.doc_id || null),
                ocrOutputPath: (typeof file === 'string') ? null : (file.ocr_output_path || null),
                isFeedApplied: false,
                isTrainingDoc: true,
              })),
            ])).flat(),
          },
        ];
      }
    }
    if (item === 'table_detection_failures') {
      if (!Object.keys(bucketResponse[item]).length) {
        classesArray = [...classesArray, ..._blankBucketResponse(BUCKET_TYPES.NO_TABLE_DETECTION)];
      } else {
        classesArray = [
          ...classesArray,
          {
            bucketId: 'class3',
            name: item === 'table_detection_failures' ? BUCKET_TYPES.NO_TABLE_DETECTION : BUCKET_TYPES.NO_TABLE_DETECTION,
            count: __calculateTotalFailedFiles(bucketResponse[item]),
            buckets: [
              ...bucketResponse[item].files.map((file) => ({
                docCategory: null,
                docId: (typeof file === 'string') ? file : (file.doc_id || null),
                ocrOutputPath: (typeof file === 'string') ? null : (file.ocr_output_path || null),
                isTrainingDoc: false,
                isFeedApplied: false,
              })),
              ...bucketResponse[item].training_set.map((file) => ({
                docCategory: null,
                docId: (typeof file === 'string') ? file : (file.doc_id || null),
                ocrOutputPath: (typeof file === 'string') ? null : (file.ocr_output_path || null),
                isFeedApplied: false,
                isTrainingDoc: true,
              })),
            ],
          },
        ];
      }
    }
  });
  return classesArray;
};

/**
 * Update flags with respect bucket
 * @param {*} buckets
 * @param {*} flag
 * @param {*} callback
 * @returns
 */
const _updateFlagsWithRespectBucket = (buckets, flag = null, callback) => {
  if (!flag) {
    return callback(null, true)
  }
  const dataToSet = {}
  if (flag === 'isNonTableFlag') {
    dataToSet.isNonTableFlag = false
  } else if (flag === 'isTableFlag') {
    dataToSet.isTableFlag = false
  } else {
    return callback(null, true);
  }
  eachSeries(buckets, (bucket, cb) => {
    documentService.update(
      { _id: bucket.docId },
      { $set: dataToSet },
      { new: false },
      (err, document) => {
        if (document.isTableFlag && document.isNonTableFlag) { // update only if passed file pushed to rejected
          idpService.update({ _id: document.idpId }, { $inc: { identifiedCount: -1, nonIdentifiedCount: 1 } }, null, cb)
        } else {
          cb(null, true)
        }
      }
    );
  }, callback)
}

/**
 * Update Flags For Docs
 * @param {*} customizedBuckets
 * @returns Promise<any>
 */
const _updateFlagsForDocs = (customizedBuckets = []) => new Promise((resolve) => {
  console.log("customizedBuckets", JSON.stringify(customizedBuckets));
  eachSeries(customizedBuckets, (bucketData, ecb) => {
    if (bucketData.bucketId === 'class2') {
      _updateFlagsWithRespectBucket(bucketData.buckets, 'isNonTableFlag', ecb);
    } else if (bucketData.bucketId === 'class3') {
      _updateFlagsWithRespectBucket(bucketData.buckets, 'isTableFlag', ecb);
    } else {
      ecb(null, true)
    }
  }, () => {
    resolve(true)
  })
})

module.exports = {
  _customizeBucketResoonse,
  _updateFlagsForDocs
};
