const CONSOLE = require('../Utils/console-log.util');

const logger = (server) => {
  server.events.on('log', (event) => {
    if (event && Array.isArray(event.tags)) {
      if (event.tags.indexOf('error') !== -1 && event.data) {
        CONSOLE.error(`ERROR, ${event.data}`);
      } else if (event.tags.indexOf('success') !== -1) {
        CONSOLE.success(`SUCESS, ${event.data}`);
      }
    }
  });

  server.events.on('response', (request) => {
    //CONSOLE.warning(`${request.headers['x-real-ip'] || request.info.remoteAddress}: ${request.method.toUpperCase()} ${request.path} --> ${request.response.statusCode}`);
  });
};

module.exports = logger;
