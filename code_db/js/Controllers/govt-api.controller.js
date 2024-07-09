const { mockPanApi, mockVahanApi } = require('../Mock');

/**
 * fetch RC details
 * @returns
 */
const fetchRC = async () => mockVahanApi();

/**
 * fetch PAN details
 * @returns
 */
const fetchPAN = async () => mockPanApi();

module.exports = {
  fetchRC,
  fetchPAN,
};
