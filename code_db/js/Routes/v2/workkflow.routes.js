const { workflowsController } = require('../../Controllers');
const { WORKFLOW_MODULE } = require('../config.routes');
const { BoomCustomError } = require('../../Utils/universal-functions.util');

const ROUTE_HANDLERS = {

  fetchWorkflow: (request) => new Promise((resolve, reject) => {
    workflowsController.fetchWorkflow(
      request.auth.credentials.user,
      request.query,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  fetchWorkflowById: (request) => new Promise((resolve, reject) => {
    workflowsController.fetchWorkflowById(
      request.auth.credentials.user,
      request.params,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  createWorkflow: (request) => new Promise((resolve, reject) => {
    workflowsController.createWorkflow(
      request.auth.credentials.user,
      request.payload,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  updateWorkflow: (request) => new Promise((resolve, reject) => {
    workflowsController.updateWorkflow(
      request.auth.credentials.user,
      request.payload,
      request.params,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  validateWorkflow: (request) => new Promise((resolve, reject) => {
    workflowsController.validateWorkflow(
      request.auth.credentials.user,
      request.payload,
      request.params,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  workflowDelete: (request) => new Promise((resolve, reject) => {
    workflowsController.workflowDelete(
      request.auth.credentials.user,
      request.payload,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
  processWorkflow: (request) => new Promise((resolve, reject) => {
    workflowsController.processWorkflow(
      request.auth.credentials.user,
      request.payload,
      (err, result) => {
        if (err) {
          return reject(BoomCustomError(err));
        }
        return resolve(result);
      },
    );
  }),
};

const routes = WORKFLOW_MODULE.map((route) => ({
  method: route.method,
  path: route.route,
  handler: ROUTE_HANDLERS[route.handler],
  options: route.options,
}));

module.exports = routes;
