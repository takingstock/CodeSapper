const config = require('config');
const { auto } = require('async');
const documentController = require('./document.controller');
const globalMappingController = require('./global-mapping.controller');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

// const stats1 = async ({ tenantId }, query, cb) => Promise.all([
//   globalMappingController.aggregateStats(tenantId, query),
//   documentController.aggregateStats(tenantId, query),
// ])
//   .then(([globalMappingStats, documentStats]) => {
//     const response = {
//       ...HTTP_SUCCESS_MESSAGES.DEFAULT,
//       data: {
//         ...documentStats,
//         userDefinedDocsWithDate: globalMappingStats,
//       },
//     };
//     return cb(response);
//   });
const stats = ({ tenantId }, query, hcb) => {
  auto({
    globalMappingStats: (cb) => {
      globalMappingController.aggregateStats(tenantId, query, (e, r) => cb(e, r));
    },
    documentStats: (cb) => {
      documentController.aggregateStats(tenantId, query, (e, r) => cb(e, r));
    }
  }, (err, { globalMappingStats, documentStats }) => {
    if (err) {
      return hcb(err)
    }
    const response = {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: {
        ...documentStats,
        userDefinedDocsWithDate: globalMappingStats,
      },
    };
    return hcb(null, response);
  })
}
module.exports = {
  stats,
};
