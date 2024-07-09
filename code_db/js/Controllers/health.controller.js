const config = require('config');
const { parallel, mapSeries } = require('async');
const { exec } = require("child_process");
const AI_ENDPOINTS = require('../Utils/ai-endpoints.util');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');

const health = (hcb) => {
  parallel({
    ocrHealth: (cb) => {
      AI_ENDPOINTS.fetchOcrHealthStatus().then((response) => cb(null, response));
    },
    feedbackHealth: (cb) => {
      AI_ENDPOINTS.fetchOcrFeedbackStatus().then((response) => cb(null, response));
    },
    // qrHealth: (cb) => {
    //   AI_ENDPOINTS.fetchQrHealthStatus().then((response) => cb(null, response));
    // },
    bucketHealth: (cb) => {
      AI_ENDPOINTS.fetchBucketizationStatus().then((response) => cb(null, response));
    },
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    const {
      ocrHealth, feedbackHealth, bucketHealth,
    } = results;
    const lastChecked = new Date().toISOString();
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: [
        {
          name: 'OCR SERVER',
          status: ocrHealth.status,
          message: ocrHealth.status ? 'Server Up' : 'Server Down',
          lastChecked,
        },
        {
          name: 'FEEDBACK SERVER',
          status: feedbackHealth.status,
          message: feedbackHealth.status ? 'Server Up' : 'Server Down',
          lastChecked,
        },
        {
          name: 'BUCKET SERVER',
          status: bucketHealth.status,
          message: bucketHealth.status ? 'Server Up' : 'Server Down',
          lastChecked,
        },
      ],
    });
  });
};

// split host and port
const _getIpAndPort = (serverIp) => {
  const workerPort = serverIp.split(':')[2] && serverIp.split(':')[2].split('/')[0];
  const workerIp = serverIp.split(':')[1] && serverIp.split(':')[1].split('//')[1]
  return ({
    workerIp,
    workerPort
  })
}
// Check server sctive
const _checkIfWorkerisActive = (serverIp, callback) => {
  const workerDetails = _getIpAndPort(serverIp);
  if (!workerDetails.workerIp || !workerDetails.workerPort) {
    return callback(null, false)
  }
  const command = `nc -zv ${workerDetails.workerIp} ${workerDetails.workerPort}`;
  exec(command, { timeout: 2000 }, (err, stdout, stderr) => {
    if (stderr.includes('succeeded') && err === null) {
      callback(null, true)
    } else if (stderr.includes("failed") && err) {
      callback(null, false)
    } else {
      callback(null, false)
    }
  })
}

const checkServersHealthParalel = (Aiserver, hcb) => {
  parallel({
    ocrHealth: (cb) => {
      if (Aiserver.documentOcr) {
        _checkIfWorkerisActive(Aiserver.documentOcr, cb);
      } else {
        cb(null, false)
      }
    },
    feedbackNonTabularHealth: (cb) => {
      if (Aiserver.nonTabularFeedback) {
        _checkIfWorkerisActive(Aiserver.nonTabularFeedback, cb);
      } else {
        cb(null, false)
      }
    },
    feedbackTabularHealth: (cb) => {
      if (Aiserver.tabularFeedback) {
        _checkIfWorkerisActive(Aiserver.tabularFeedback, cb);
      } else {
        cb(null, false)
      }
    },
    bucketHealth: (cb) => {
      if (Aiserver.documentBucketing) {
        _checkIfWorkerisActive(Aiserver.documentBucketing, cb);
      } else {
        cb(null, false)
      }
    },
    snippletHealth: (cb) => {
      if (Aiserver.documentSnipplet) {
        _checkIfWorkerisActive(Aiserver.documentSnipplet, cb);
      } else {
        cb(null, false)
      }
    },
  }, (err, results) => {
    if (err) {
      return hcb(err);
    }
    const {
      ocrHealth, feedbackHealth, bucketHealth, feedbackNonTabularHealth, feedbackTabularHealth, snippletHealth
    } = results;
    return hcb(null, {
      ocrHealth, feedbackHealth, bucketHealth, feedbackNonTabularHealth, feedbackTabularHealth, snippletHealth
    });
  });
}
const aiServersHealthCb = (servers, callback) => {
  mapSeries(servers, (server, callback) => {
    checkServersHealthParalel(server, (err, res) => {
      callback(err, { ...server, ...res });
    })
  }, callback)
}
module.exports = {
  health,
  aiServersHealthCb
};
