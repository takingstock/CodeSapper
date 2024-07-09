const mockBucketResponse = {
  partial_key_value_failures: {
    invoice: {
      files: [
        '61c2f03491c922c52bb4821e',
      ],
      training_set: ['61c2f03491c922c52bb4821f'],
    },
  },
  table_detection_failures: {
    files: ['61c33652a90985453532edd1'],
    training_set: ['61c33652a90985453532edd2'],
  },
  no_detection: {
    new_format_1: {
      files: ['61c33652a90985453532edd3'],
      training_set: ['61c33652a90985453532edd4'],
    },
    new_format_2: {
      files: ['61c33652a90985453532edd5'],
      training_set: ['61c33652a90985453532edd6'],
    },
    new_format_3: {
      files: ['61c33652a90985453532edd7'],
      training_set: ['61c33652a90985453532edd8'],
    },
  },
};
module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  mockBucketResponse,
};
