const config = require('config');
const { auto } = require('async');
const { workflowService } = require('../Services');
const { createMongooseId } = require('../Utils/universal-functions.util');
const { addWorkflowToInputSource } = require('../Utils/input-storage.util');

const HTTP_SUCCESS_MESSAGES = config.get('STATUS_MSG.SUCCESS');
const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');

const _getDocObj = (docId, docs) => docs.find((doc) => doc.docId === docId);

const _createVariables = (variableType, variablesArray = []) => {
  if (variableType === 'ocr' || variableType === 'qr') {
    return variablesArray.map((variable) => {
      const { documentType, variables = [] } = variable;
      const mappedVariables = variables
        .filter((item) => item.selected)
        .map((item) => ({
          variableType,
          key: item.key,
          source: `@${documentType}.${item.key}`,
          alias: null,
        }));
      return mappedVariables;
    }).flat();
  }
  return variablesArray.map((variable) => {
    const { componentName, variables = [] } = variable;
    const mappedVariables = variables.filter((item) => item.selected).map((item) => ({
      variableType,
      key: item.key,
      source: `@${componentName || 'matchComponent'}.${item.key}`,
      alias: null,
    }));
    return mappedVariables;
  }).flat();
};

const _createLogic = (components = [], docs) => components.map((component) => {
  const {
    componentId,
    validationType = null, validations = [], name: componentName,
    condition, conditionName,
  } = component;
  const mappedvalidations = validations.map((validation) => {
    const {
      lhsDoc, lhsKey, operator, rhsDoc, rhsKey, variable,
    } = validation;
    const obj = {
      componentId,
      validationType,
      condition,
      conditionName,
      operator,
      lhs: {
        key: lhsDoc !== 'STATIC_VALUE' ? `@${_getDocObj(lhsDoc, docs).docType}.${lhsKey}` : lhsKey,
        type: lhsDoc !== 'STATIC_VALUE' ? 'variable' : 'external_data', // variable or external_data
      },
      rhs: {
        key: rhsDoc !== 'STATIC_VALUE' ? `@${_getDocObj(rhsDoc, docs).docType}.${rhsKey}` : lhsKey,
        type: rhsDoc !== 'STATIC_VALUE' ? 'variable' : 'external_data',
      },
      static: (lhsDoc === 'STATIC_VALUE' || rhsDoc === 'STATIC_VALUE') ? true : null,
      storeAsVariable: variable,
    };
    return {
      ...obj,
      data: {},
      storeAsVariable: `@${componentName}.${variable}`,
    };
  });
  return {
    storeAsVariable: condition !== 'SINGLE' ? `@${componentName}.${conditionName}` : null,
    validations: mappedvalidations,
  };
}).flat();

const _createDt = (dt = {}) => {
  const {
    frontendJSON = {}, variablesInFlow = {}, primaryDocId, docIds: docs = [],
  } = dt;

  const { ocr = [], qr = [], derived = [] } = variablesInFlow;
  const { components = [] } = frontendJSON;
  const variables = [
    ..._createVariables('ocr', ocr),
    ..._createVariables('qr', qr),
    ..._createVariables('derived', derived),
  ];
  const validationBeingUsed = variables.map((item) => item.source);
  let dtAdvaced = {
    input: {},
    dt: {},
    output: {
      variableMapping: null,
      storeAsVariable: '@dtResult',
    },
  };
  dtAdvaced = {
    ...dtAdvaced,
    input: {
      primaryDocId,
      docs,
    },
    output: {
      ...dtAdvaced.output,
      variableMapping: variables,
    },
    dt: {
      startNode: {
        next: 'node_1',
      },
      node_1: {
        nodeType: 'RULE_DO_OCR',
        storeAsVariable: '@derivedOcr',
        next: 'node_2',
      },
      node_2: {
        nodeType: 'RULE_LOGICAL_COMPARISION',
        storeAsVariable: '@derivedMatchName',
        logic: _createLogic(components, docs),
        next: 'endNode',
      },
      endNode: {
        nodeType: 'WORKFLOW_END',
        textToDisplay: 'WOFKFLOW have been executed',
      },
    },
  };
  return {
    backendJSON: dtAdvaced,
    validationBeingUsed,
  };
};

const fetchWorkflow = ({ tenantId }, {
  q = '', fields = null, isPublished = null, limit = 0, offset = 0, sortBy = 'createdAt', orderBy = 'DESC', workflowType = 'none'
}, hcb) => {
  const sortObj = {
    [sortBy]: orderBy === 'DESC' ? -1 : 1,
  };
  const query = {
    tenantId: createMongooseId(tenantId),
    isDeleted: false,
  };
  let projection = { isDeleted: 0 };
  if (q) {
    query.workflow = {
      $regex: new RegExp(q, 'i'),
    };
  }
  if (fields) {
    const fieldsArray = fields.split(',');
    if (fields.length) {
      projection = {};
      fieldsArray.forEach((field) => {
        projection[field] = 1;
      });
    }
  }
  if (typeof isPublished === 'boolean') {
    query.published = isPublished;
  }
  const lookups = [];
  const pagination = {
    offset,
    limit,
    sort: sortObj,
  };
  if (workflowType === 'default') {
    query.createdVia = 'SYSTEM';
    query.static = false;
  }
  if (workflowType === 'custom') {
    query.createdVia = 'USER';
  }
  if (workflowType === 'static') {
    query.static = true;
  }
  workflowService.findAllByAggregation(
    query, projection, lookups, pagination, (err, result) => {
      if (err) {
        return hcb(err);
      }
      const { dataList, count } = result[0];
      const totalCount = count[0] && count[0].count ? count[0].count : 0;
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
        data: dataList,
        totalCount,
      });
    },
  );
};

const fetchWorkflowById = async ({ tenantId }, { id: workflowId }, hcb) => {
  const query = {
    tenantId,
    _id: workflowId,
  };
  workflowService.findOne(query, (err, result) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: result,
    });
  });
};

const createWorkflow = ({ tenantId }, payloadObj, hcb) => {
  const {
    name, country, variablesInFlow = {}, primaryDocId, docIds = [], inputJSON = {}
  } = payloadObj;
  let payload = {
    tenantId,
    workflow: name,
    country,
    primaryDocId,
    docIds,
    inputJSON
  };
  if (Object.keys(variablesInFlow).length) {
    payload.variablesInFlow = variablesInFlow;
  }
  payload = {
    ...payload,
    ..._createDt(payloadObj),
  };
  auto({
    fetchWorkflow: (cb) => {
      workflowService.findOne({ tenantId, workflow: name }, (err, result) => {
        if (err) {
          return cb(err);
        }
        if (result) {
          return cb(HTTP_ERROR_MESSAGES.WORKFLOW_EXISTS);
        }
        return cb(null, true);
      });
    },
    createWorkflow: ['fetchWorkflow', (_, cb) => {
      workflowService.create(payload, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    }],
  }, (err, result) => {
    if (err) {
      return hcb(err);
    }
    addWorkflowToInputSource(inputJSON, result.createWorkflow._id, (e) => {
      console.log("workflow added to inptSource", e)
    })
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: result.createWorkflow,
    });
  });
};

const updateWorkflow = async (
  { tenantId, id: userId },
  payloadObj,
  { id: workflowId }, hcb,
) => {
  const {
    name = null, country = null, docIds = [],
    primaryDocId = null, published = null, frontendJSON = {},
    variablesInFlow = {}, outputJSON = {}, webhookId = null, inputJSON = {}
  } = payloadObj;
  auto({
    fetchWorkflow: (cb) => {
      if (name) {
        return workflowService.findOne(
          { tenantId, workflow: name, _id: { $nin: [workflowId] } },
          (err, result) => {
            if (err) {
              return cb(err);
            }
            if (result) {
              return cb(HTTP_ERROR_MESSAGES.WORKFLOW_EXISTS);
            }
            return cb(null, true);
          },
        );
      }
      return cb(null, true);
    },
    updateWorkflow: ['fetchWorkflow', (_, cb) => {
      let payload = {
        frontendJSON,
        outputJSON,
        inputJSON
      };
      if (name) {
        payload.workflow = name;
      }
      if (country) {
        payload.country = country;
      }
      if (docIds && docIds.length) {
        payload.docIds = docIds;
      }
      if (primaryDocId) {
        payload.primaryDocId = primaryDocId;
      }
      if (webhookId) {
        payload.webhookId = webhookId;
      }
      if (typeof published === 'boolean') {
        payload.published = published;
        if (published) {
          payload.publishedAt = new Date();
          payload.status = 'Published';
        } else {
          payload.status = 'Draft';
        }
      }
      payload.variablesInFlow = variablesInFlow;
      payload.updatedAt = new Date();
      payload.updatedBy = userId;
      payload = {
        ...payload,
        ..._createDt(payloadObj),
      };
      const criteria = {
        _id: workflowId,
        tenantId,
      };
      workflowService.update(criteria, { $set: payload }, { new: true }, (err, result) => {
        if (err) {
          return cb(err);
        }
        return cb(null, result);
      });
    }],
  }, (err, result) => {
    if (err) {
      return hcb(err);
    }
    addWorkflowToInputSource(inputJSON, result.updateWorkflow._id, (e) => {
      console.log("workflow added to inptSource", e)
    })
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: result.updateWorkflow,
    });
  });
};

const validateWorkflow = async (
  { tenantId, id: userId },
  payloadObj,
  { id: workflowId },
  hcb,
) => {
  const {
    frontendJSON, variablesInFlow = {}, primaryDocId, docIds = [], webhookId = null
  } = payloadObj;
  let payload = {
    frontendJSON,
    updatedAt: new Date(),
    updatedBy: userId,
    primaryDocId,
    docIds,
  };
  const criteria = {
    _id: workflowId,
    tenantId,
  };
  if (Object.keys(variablesInFlow).length) {
    payload.variablesInFlow = variablesInFlow;
  }
  if (webhookId) {
    payload.webhookId = webhookId;
  }
  payload = {
    ...payload,
    ..._createDt(payloadObj),
  };
  workflowService.update(criteria, { $set: payload }, { new: true }, (err) => {
    if (err) {
      return hcb(err);
    }
    return hcb(null, {
      ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      data: {
        isValid: true,
      },
    });
  });
};

/**
 * config delete
 * @param {Object} userInfo
 * @param {Object} payload
 * @returns
 */
const workflowDelete = ({ id }, { recordIds }, hcb) => {
  const criteria = {
    _id: {
      $in: recordIds,
    },
  };
  workflowService
    .deleteMany(criteria, (err) => {
      if (err) {
        return hcb(err);
      }
      return hcb(null, {
        ...HTTP_SUCCESS_MESSAGES.DEFAULT,
      });
    });
};

const processWorkflow = async (
  { user },
  { batchId, workflowId },
  hcb,
) => {
  console.log('processWorkflow', workflowId, batchId);
  return hcb(null, {
    ...HTTP_SUCCESS_MESSAGES.DEFAULT,
    message: 'Workflow started processing',
    data: user
  });
};

module.exports = {
  fetchWorkflow,
  fetchWorkflowById,
  createWorkflow,
  updateWorkflow,
  validateWorkflow,
  processWorkflow,
  workflowDelete,
};
