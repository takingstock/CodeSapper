const {
  start,
  stop,
  BASE_PATH,
  httpClient,
} = require('../config');

let server = null;

beforeAll(async () => {
  server = await start();
});

afterAll(async () => {
  await stop(server);
});

describe('SERVER_HEALTH', () => {
  it('Server should responds with 200', async () => {
    const { status } = await httpClient.get(BASE_PATH);
    expect(status).toEqual(200);
  });
});
