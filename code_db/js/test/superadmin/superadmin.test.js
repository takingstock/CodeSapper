const {
  start,
  stop,
  BASE_PATH_V1,
  createHeaders,
  httpClient,
} = require('../config');

const { SUPER_ADMIN } = require('../mock');

let server = null;
let token = null;

beforeAll(async () => {
  server = await start();
});

afterAll(async () => {
  await stop(server);
});

describe('SUPER_ADMIN: Authentication Test', () => {
  it('user/login responds with 200', async () => {
    const payload = SUPER_ADMIN;
    const { status, data: response } = await httpClient.post(`${BASE_PATH_V1}user/login`, payload);
    const { data } = response;
    const { user } = data;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('accessToken');
    expect(user).toHaveProperty('role');
    expect(user.role).toEqual('SUPER_ADMIN'); // superadmin role
    token = data.accessToken;
  });

  it('user/list responds with 200', async () => {
    const { status, data: response } = await httpClient.get(`${BASE_PATH_V1}admin/users`, {
      headers: createHeaders(token),
    });
    const { data } = response;
    expect(status).toEqual(200);
    expect(data.length).toBeGreaterThanOrEqual(0);
  });
});
