const v1Routes = require('./v1/config.v1');
const v2Routes = require('./v2/config.v2');

// const { LOG_APPLICATION_ACTIVITY_ERRORS } = require('../Utils/logger.util');

const ROUTE_HANDLER = (routes, handler) => routes.find((route) => route.handler === handler);

const ROUTE_ERR_HANDLER = (request, module, handler, err) => {
  // LOG_APPLICATION_ACTIVITY_ERRORS(
  //   request,
  //   err,
  //   ROUTE_HANDLER(module, handler).internalErrorMessage,
  // );
  return err;
};

module.exports = {
  ...v1Routes,
  ...v2Routes,
  ROUTE_ERR_HANDLER,
  ROUTE_HANDLER,
};
