const config = require('config');

const fs = require('fs');

const FormData = require('form-data');
const axios = require('axios');

const IMC_APIS = config.get('IMC.APIS');
const IMC = config.get('IMC');
const AXIOS_TIMEOUT = config.get('SERVER.AXIOS_TIMEOUT');
const OCR_UPLOAD_INPUT_KEY = config.get('OCR_UPLOAD_INPUT_KEY');

const httpClient = axios.create();
httpClient.defaults.timeout = AXIOS_TIMEOUT;

// send email
const sendEmail = async ({
  emails = null,
  subject = null,
  body = null,
  filePath = null,
  apiTarget = null,
}) => {
  // check to add for if not want to send
  // permission, let say test env
  // by default Permission flag set to true for all environments
  // except test env - local env
  const NODE_ENV = process.env.NODE_ENV_LABEL || process.env.NODE_ENV
  let subj = subject
  if (!IMC.SMS_SENT_PERMISSION) {
    return true;
  }
  let toEmails = null;
  if (emails && !apiTarget) { // generic emails
    toEmails = emails;
  } else if (apiTarget === 'OCR') { // ocr teams
    toEmails = IMC.OCR_RESPONSIBLE_TEAM;
  } else if (apiTarget === 'FEEDBACK') { // feedback team
    toEmails = IMC.FEEDBACK_RESPONSIBLE_TEAM;
  } else if (apiTarget === 'PLATFORM') { // feedback team
    toEmails = IMC.PLATFORM_TEAM;
  } else if (apiTarget === 'REPORTS') {
    toEmails = IMC.REPORTS_TEAM;
  } else if (apiTarget === 'DEV_TESTING') {
    toEmails = IMC.DEV_TESTING;
  } else if (apiTarget === 'ALERTS') {
    toEmails = IMC.ALERTS_TEAM;
  } else if (apiTarget === 'NEW_ALERTS') {
    toEmails = IMC.NEW_ALERTS;
  } else if (apiTarget === 'QUEUE_LOGS') {
    toEmails = IMC.QUEUE_LOGS;
  } else if (apiTarget === 'LOGS') {
    toEmails = IMC.LOGS_TEAM;
  } else if (apiTarget === 'QUEUE_SIZE_ALERT') {
    toEmails = IMC.OCR_RESPONSIBLE_TEAM;
  } else if (apiTarget === 'QUEUE_SIZE_ALERT2') {
    toEmails = IMC.QUEUE_SIZE_TEAM;
  }
  if (apiTarget) {
    if (!subj.includes(NODE_ENV)) {
      subj = `${subj} | ${NODE_ENV}`
    }
  }
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve) => {
    try {
      const formData = new FormData();
      if (filePath) {
        formData.append(OCR_UPLOAD_INPUT_KEY, fs.createReadStream(filePath));
      }
      if (process.env.NODE_ENV_LABEL === "TESITNG LOCAL") {
        toEmails = "auqib@amygb.ai"
      }
      formData.append('emails', toEmails);
      formData.append('subject', subj);
      formData.append('body', body);
      const headers = { ...formData.getHeaders() };
      const url = IMC_APIS.EMAIL_SEND;
      await httpClient.post(url, formData, { headers });
      return resolve(true);
    } catch (err) {
      console.log("ERROR WHILE SENDing email alert", err)
      return resolve(false);
    }
  });
};

module.exports = {
  sendEmail
};
