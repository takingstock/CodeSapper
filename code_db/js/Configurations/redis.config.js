/* eslint-disable no-console */
const config = require('config');

const NodeRSA = require('node-rsa'); // Install Node Module node-rsa
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const redis = require('redis');

const chalk = require('chalk');

// const error = chalk.bold.red;
const { green, red } = chalk.bold;

const fileConfig = config.get('IMP_FILES');
const REDIS_EVENTS = config.get('EVENTS.REDIS');
const REDIS = config.get('REDIS');

const redisConfig = {
  port: process.env.REDIS_PORT || REDIS.PORT,
  uri: process.env.REDIS_URI || REDIS.URI,
};

let FINAL_IMP_FILES_DIR = fileConfig.PATH;
if (os.platform() === 'darwin') {
  FINAL_IMP_FILES_DIR = `${process.env.HOME}/Downloads/amygb_projects/important_files/apb-mailera/`;
}

const privateKeyPath = `${FINAL_IMP_FILES_DIR}private_key.pem`;
const publicKeyPath = `${FINAL_IMP_FILES_DIR}public_key.pem`;

const redisClient = redis.createClient(redisConfig.port, redisConfig.uri);

redisClient.on(REDIS_EVENTS.ERROR, (err) => {
  console.log(red(`Error ${err}`));
});

redisClient.on(REDIS_EVENTS.CONNECT, () => {
  console.log(green('[Redis-Server] is ready'));
});

let absolutePath;
let publicKey;

const loadPublicKey = () => {
  absolutePath = path.resolve(publicKeyPath);
  publicKey = fs.readFileSync(absolutePath, 'utf8');
};

process.on('LOAD_PUBLIC_KEY', () => {
  loadPublicKey();
});

const encryptStringWithRsaPublicKey = (toEncrypt) => {
  const buffer = Buffer.from(toEncrypt);
  const encrypted = crypto.publicEncrypt(publicKey, buffer);
  return encrypted.toString('base64');
};

let PrivateKeyContent;
let AmyGBPrivateKey;

const loadPrivateKey = () => {
  PrivateKeyContent = fs.readFileSync(privateKeyPath);
  AmyGBPrivateKey = new NodeRSA(PrivateKeyContent);
};

process.on('LOAD_PRIVATE_KEY', () => {
  loadPrivateKey();
});

const decryptStringWithRsaPrivateKey = (toDecrypt) => {
  const responseBuffer = Buffer.from(toDecrypt, 'base64');
  const DecryptedBuffer = AmyGBPrivateKey.decrypt(responseBuffer);
  const DecryptedResponse = JSON.parse(DecryptedBuffer);
  return DecryptedResponse;
};

module.exports = {
  redisClient,
  encryptStringWithRsaPublicKey,
  decryptStringWithRsaPrivateKey,
};
