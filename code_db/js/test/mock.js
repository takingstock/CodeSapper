const fs = require('fs');
const { join } = require('path');
const FormData = require('form-data');

const createBatchPayload = (configId) => {
  const formData = new FormData();
  const BATCH_FILES_PATH = join(__dirname, './batch/INSURANCE_USE_CASE.zip');
  formData.append('files', fs.createReadStream(BATCH_FILES_PATH));
  formData.append('configId', configId);
  return formData;
};

const SUPER_ADMIN = {
  email: 'sunnyx@amygb.ai',
  password: 'Gsva#123bnm',
};

const ENTERPRISE_ADMIN = {
  email: 'sunny@amygb.ai',
  password: 'Gsva#123bnm',
};

const REGISTER_USER = {
  firstName: 'Tech',
  emailId: 'techyaura@gmail.com',
  lastName: 'Aura',
  phoneNumber: '1234567890',
  companyName: 'Tech Aura',
  jobTitle: 'Software Engineer',
  region: 'India',
};

const WORKFLOW_CREATE = {
  name: 'Mock Workflow',
  docIds: ['61f4bd8accb6a2818ad16e04'],
  country: 'India',
};

const WORKFLOW_UPDATE = {
  frontendJSON: {
    test: 'test',
  },
  ...WORKFLOW_CREATE,
};

const WORKFLOW_VALIDATE = {
  frontendJSON: {
    name: 'Mock Workflow',
    docIds: ['61f4bd8accb6a2818ad16e04'],
    country: 'India',
  },
};

const CONFIG_ID = '61a72939f1662a8d9f5f6314';

module.exports = {
  REGISTER_USER,
  ENTERPRISE_ADMIN,
  SUPER_ADMIN,
  WORKFLOW_CREATE,
  WORKFLOW_VALIDATE,
  WORKFLOW_UPDATE,
  CONFIG_ID,
  createBatchPayload,
};
