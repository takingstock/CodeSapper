process.env.NODE_ENV = 'test';

const axios = require('axios');

const { start, stop } = require('../Configurations/server.config');

const httpClient = axios.create();

const BASE_PATH = 'http://0.0.0.0:3690/';
const BASE_PATH_V1 = 'http://0.0.0.0:3690/api/v1/';
const BASE_PATH_V2 = 'http://0.0.0.0:3690/api/v2/';

const createHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
});

const getToken = async () => {
  const payload = {
    email: 'auqib@amygb.ai',
    password: 'Gsva#123bnm',
  };
  const { data: response } = await httpClient.post(`${BASE_PATH_V1}user/login`, payload);
  const { data } = response;
  return data.accessToken;
};

module.exports = {
  BASE_PATH,
  BASE_PATH_V1,
  BASE_PATH_V2,
  httpClient,
  createHeaders,
  start,
  stop,
  getToken,
};
