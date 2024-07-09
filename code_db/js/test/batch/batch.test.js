const { auto } = require('async');
const { idpService } = require('../../Services');

const {
  start,
  stop,
  BASE_PATH_V1,
  createHeaders,
  httpClient,
  getToken,
} = require('../config');

const { CONFIG_ID, createBatchPayload } = require('../mock');

let server = null;
let token = null;
let batchID = null;
let formData = null;
let headers = null;

beforeAll(async () => {
  server = await start();
  token = await getToken();
  formData = createBatchPayload(CONFIG_ID);
  headers = { ...formData.getHeaders() };
});

afterAll(async () => {
  await stop(server);
  auto({
    removeBatch: (cb) => idpService.deleteMany({ _id: batchID }, cb),
  });
});

describe('batch: CRUD', () => {
  it('batch/list responds with 200', async () => {
    const { status, data: response } = await httpClient.get(`${BASE_PATH_V1}idp`, {
      headers: createHeaders(token),
    });
    const { data } = response;
    expect(status).toEqual(200);
    expect(data.length).toBeGreaterThanOrEqual(0);
  });

  it('batch/upload responds with 200', async () => {
    const { status, data: response } = await httpClient.post(`${BASE_PATH_V1}idp/upload`, formData, {
      headers: {
        ...headers,
        ...createHeaders(token),
      },
    });
    const { data } = response;
    batchID = data._id;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('timeUnit');
    expect(data).toHaveProperty('timeConsumed');
  });

  //   it('workflow/detail responds with 200', async () => {
  //     const { status, data: response } = await httpClient.get(`${BASE_PATH_V1}workflows/${workflowId}`, {
  //       headers: createHeaders(token),
  //     });
  //     const { data } = response;
  //     expect(status).toEqual(200);
  //     expect(data).toHaveProperty('workflow');
  //     expect(data).toHaveProperty('docIds');
  //     expect(data).toHaveProperty('country');
  //     expect(data).toHaveProperty('frontendJSON');
  //     expect(data).toHaveProperty('backendJSON');
  //   });

  //   it('workflow/validate responds with 200', async () => {
  //     const payload = WORKFLOW_VALIDATE;
  //     const { status, data: response } = await httpClient.put(`${BASE_PATH_V1}workflows/validate/${workflowId}`, payload, {
  //       headers: createHeaders(token),
  //     });
  //     const { data } = response;
  //     expect(status).toEqual(200);
  //     expect(data).toHaveProperty('isValid');
  //   });

//   it('workflow/update responds with 200', async () => {
//     const payload = WORKFLOW_UPDATE;
//     const { status, data: response } = await httpClient.put(`${BASE_PATH_V1}workflows/${workflowId}`, payload, {
//       headers: createHeaders(token),
//     });
//     const { data } = response;
//     expect(status).toEqual(200);
//     expect(data).toHaveProperty('workflow');
//     expect(data).toHaveProperty('docIds');
//     expect(data).toHaveProperty('country');
//     expect(data).toHaveProperty('frontendJSON');
//     expect(data).toHaveProperty('backendJSON');
//   });
});
