/* eslint-disable no-console */
const config = require('config');

const fileConfig = config.get('IMP_FILES');

const privateKeyPath = `${fileConfig.PATH}private_key.pem`;
const publicKeyPath = `${fileConfig.PATH}public_key.pem`;
const tempPemPath = `${fileConfig.PATH}temp.pem`;
const { spawn } = require('child_process');
const fsXtra = require('fs-extra');

const bootstrapPrivateKey = (callback) => {
  fsXtra.ensureDir(fileConfig.PATH)
    .then(() => {
      fsXtra.pathExists(privateKeyPath)
        .then((isExists) => {
          if (!isExists) {
            const child = spawn(`openssl genrsa -out ${privateKeyPath} 4096 && mv ${privateKeyPath} ${tempPemPath} && openssl pkcs8 -topk8 -inform pem -in ${tempPemPath} -outform pem -nocrypt -out ${privateKeyPath} && rm ${tempPemPath} && openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`, {
              shell: true,
            });

            child.stderr.on('data', (data) => {
              console.error('STDERR:', data.toString());
            });
            child.stdout.on('data', (data) => {
              console.log('STDOUT:', data.toString());
            });
            child.on('exit', (exitCode) => {
              console.log(`Child exited with code: ${exitCode}`);
              callback();
            });
          } else {
            callback();
          }
        })
        .catch((err) => {
          console.error('key generation error:', err);
          callback(err);
        });
    })
    .catch((err) => {
      console.error('Path ensure error:', err);
      callback(err);
    });
};

module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  bootstrapPrivateKey,
};
