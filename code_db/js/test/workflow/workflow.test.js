const { auto } = require('async');
const { workflowService } = require('../../Services');

const {
  start,
  stop,
  BASE_PATH_V2,
  createHeaders,
  httpClient,
  getToken,
} = require('../config');

const { WORKFLOW_CREATE, WORKFLOW_VALIDATE, WORKFLOW_UPDATE } = require('../mock');

let server = null;
let token = null;
let workflowId = null;

beforeAll(async () => {
  server = await start();
  token = await getToken();
});

afterAll(async () => {
  await stop(server);
  auto({
    removeWorkflow: (cb) => workflowService.deleteMany({ workflow: WORKFLOW_CREATE.name }, cb),
  });
});

describe('workflow: CRUD', () => {
  it('workflow/list responds with 200', async () => {
    const { status, data: response } = await httpClient.get(`${BASE_PATH_V2}workflows`, {
      headers: createHeaders(token),
    });
    const { data } = response;
    expect(status).toEqual(200);
    expect(data.length).toBeGreaterThanOrEqual(0);
  });

  it('workflow/create responds with 200', async () => {
    const payload = WORKFLOW_CREATE;
    const { status, data: response } = await httpClient.post(`${BASE_PATH_V2}workflows`, payload, {
      headers: createHeaders(token),
    });
    const { data } = response;
    workflowId = data._id;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('workflow');
    expect(data).toHaveProperty('docIds');
    expect(data).toHaveProperty('country');
    expect(data).toHaveProperty('frontendJSON');
    expect(data).toHaveProperty('backendJSON');
  });

  it('workflow/detail responds with 200', async () => {
    const { status, data: response } = await httpClient.get(`${BASE_PATH_V2}workflows/${workflowId}`, {
      headers: createHeaders(token),
    });
    const { data } = response;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('workflow');
    expect(data).toHaveProperty('docIds');
    expect(data).toHaveProperty('country');
    expect(data).toHaveProperty('frontendJSON');
    expect(data).toHaveProperty('backendJSON');
  });

  it('workflow/validate responds with 200', async () => {
    const payload = WORKFLOW_VALIDATE;
    const { status, data: response } = await httpClient.put(`${BASE_PATH_V2}workflows/validate/${workflowId}`, payload, {
      headers: createHeaders(token),
    });
    const { data } = response;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('isValid');
  });

  it('workflow/update responds with 200', async () => {
    const payload = WORKFLOW_UPDATE;
    const { status, data: response } = await httpClient.put(`${BASE_PATH_V2}workflows/${workflowId}`, payload, {
      headers: createHeaders(token),
    });
    const { data } = response;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('workflow');
    expect(data).toHaveProperty('docIds');
    expect(data).toHaveProperty('country');
    expect(data).toHaveProperty('frontendJSON');
    expect(data).toHaveProperty('backendJSON');
  });
});
