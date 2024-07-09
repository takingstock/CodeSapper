const { mockBucketResponse } = require('./bucket.mock');
const { mockDecisionTreeUseCase1 } = require('./decision.tree');
const { mockNonTabularResponse, mockTabularResponse } = require('./feedback.mock');
const { GLOBAL_MAPPING_MOCK } = require('./global-mapping.mock');
const { mockVahanApi, mockPanApi } = require('./gov.api.mock');
const { mockOcrResponseSource } = require('./ocr.mock');
const { mockTrainingResponse } = require('./training.mock');

module.exports = {
  mockBucketResponse,
  mockDecisionTreeUseCase1,
  mockNonTabularResponse,
  mockTabularResponse,
  GLOBAL_MAPPING_MOCK,
  mockVahanApi,
  mockPanApi,
  mockOcrResponseSource,
  mockTrainingResponse,
};
