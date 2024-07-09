const { auto } = require('async');
const { userService, tenantService } = require('../../Services');

const {
  start,
  stop,
  BASE_PATH_V1,
  createHeaders,
  httpClient,
} = require('../config');

const { REGISTER_USER, ENTERPRISE_ADMIN } = require('../mock');

let server = null;
let token = null;

beforeAll(async () => {
  server = await start();
});

afterAll(async () => {
  await stop(server);
});

describe('USER: Authentication Test', () => {
  afterEach(async () => {
    // remove the resgistered user & its company
    auto({
      removeUser: (cb) => userService.deleteMany({ email: REGISTER_USER.emailId }, cb),
      removeCompany: (cb) => tenantService.deleteMany({ name: REGISTER_USER.companyName }, cb),
    });
  });

  it('user/login responds with 200', async () => {
    const payload = ENTERPRISE_ADMIN;
    const { status, data: response } = await httpClient.post(`${BASE_PATH_V1}user/login`, payload);
    const { data } = response;
    const { user } = data;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('accessToken');
    expect(user).toHaveProperty('role');
    expect(user.role).toEqual('ENTERPRISE_ADMIN'); // customer role
    token = data.accessToken;
  });

  it('user/list responds with 200', async () => {
    const { status, data: response } = await httpClient.get(`${BASE_PATH_V1}users`, {
      headers: createHeaders(token),
    });
    const { data } = response;
    expect(status).toEqual(200);
    expect(data.length).toBeGreaterThanOrEqual(0);
  });

  it('user/resgister responds with 200', async () => {
    jest.setTimeout(15000);
    const payload = REGISTER_USER;
    const { status, data: response } = await httpClient.post(`${BASE_PATH_V1}user/register`, payload);
    const { data } = response;
    expect(status).toEqual(200);
    expect(data).toHaveProperty('email');
    expect(data).toHaveProperty('password');
    expect(data).toHaveProperty('firstName');
    expect(data).toHaveProperty('lastName');
    expect(data).toHaveProperty('phoneNumber');
    expect(data).toHaveProperty('jobTitle');
    expect(data).toHaveProperty('region');
  });
});
