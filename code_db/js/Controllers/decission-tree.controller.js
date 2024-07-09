/* eslint-disable no-async-promise-executor */
/* eslint-disable no-prototype-builtins */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
const { auto } = require('async');
const path = require('path');
const fsXtra = require('fs-extra');
const config = require('config');
const moment = require('moment');
const _ = require('lodash');
const { writeFile } = require('fs');
const { mockDecisionTreeUseCase1 } = require('../Mock/decision.tree');
const {
  globalMappingService,
  documentService,
  workflowService,
  idpService
} = require('../Services');
const AI_ENDPOINTS = require('../Utils/ai-endpoints.util');
const { BoomCustomError, createNewMongooseId } = require('../Utils/universal-functions.util');
const { createXcelFile } = require('../Utils/excel');
const CONSOLE = require('../Utils/console-log.util');
const { _customiseDocumentsForProcessing, _processAiOnDocuments } = require('../Helpers/cron');
const { sendDataToExternalDb } = require('./external-db-config.controller')
const { sendDataToAPI } = require('./webhook.controller')

const AI_STATUS = config.get('AI_STATUS');
const { join } = path;
class DecisionTreeController {
  constructor() {
    this.workflowTree = null;
    this.currentStep = 1;
    this.variablesInFlow = {};
  }

  // [TODO]- wil remove this method as it is for just testing
  writeJsonIntoFile(response) {
    const filesToWitePath = join(__dirname, '../../', 'ai_logic.json');
    fsXtra.ensureFileSync(filesToWitePath);
    const acknowledgemnet = new Promise((resolve, reject) => {
      writeFile(filesToWitePath, JSON.stringify(response), 'utf8', (err) => {
        if (err) {
          return reject(err);
        }
        return resolve(true);
      });
    });
    return acknowledgemnet;
  }

  groupOcrListByDocType(ocrList = []) {
    const grouped = _.mapValues(
      _.groupBy(ocrList, 'docType'),
      (docList) => docList.map((doc) => _.omit(doc, 'docType')),
    );
    return grouped;
  }

  async callAiForExecutingLogics(payload) {
    await AI_ENDPOINTS.ocrValidateLogics(payload);
    console.log('writting into files', payload);
    await this.writeJsonIntoFile(payload);
    // process.exit(1);
  }

  async fetchDocumentsWrtBatch(idpId) {
    return documentService
      .findAll(
        { isDeleted: false, idpId },
        {
          filePath: 1,
          tenantId: 1,
          fileOriginalName: 1,
          mapping: 1,
          isNonTableFlag: 1,
          isTableFlag: 1,
          'pageArray.tabularContent': 1,
          'pageArray.nonTabularContent': 1,
          'isFeedbackApplied': 1,
          table_columns: 1,
          externalId: 1,
          pageRange: 1,
          docType: 1
        },
      );
  }

  async fetchGlobalMapping(inputs = {}) {
    // [TODO]= error handling
    await Promise.all(Object.keys(inputs).map(async (item) => {
      const { mapping = [] } = await globalMappingService
        .findOne(
          { _id: inputs[item].mappingId },
          {
            documentType: 1,
            docCategory: 1,
            mapping: 1,
            isTablePresent: 1,
            isUserDefined: 1,
            isDefaultDoc: 1,
          },
        ) || {};
      this.variablesInFlow = {
        ...this.variablesInFlow,
        [inputs[item].storeAsVariable]: mapping,
      };
    }));
    return true;
  }

  inspectOutputSource(key) {
    if (key.includes('.')) {
      return {
        source: key.split('.')[0],
        key: key.split('.')[1],
      };
    }
    return {
      key,
      source: null,
    };
  }

  calculateVariablesvalue(logic) {
    const obj = {};
    const { value1, value2 } = logic;
    const { key: key1, source: source1 = null } = this.inspectOutputSource(value1.source);
    const { key: key2, source: source2 = null } = this.inspectOutputSource(value2.source);
    if (this.variablesInFlow.hasOwnProperty(source1)) {
      obj.value1 = this.variablesInFlow[source1][key1]?.value;
    }
    if (this.variablesInFlow.hasOwnProperty(source2)) {
      obj.value2 = this.variablesInFlow[source2][key2]?.value;
    }
    return obj;
  }

  async logicalComparison(currentNode, tree) {
    const requestBody = {
      ...this.variablesInFlow.payload,
      primaryDoc: this.variablesInFlow.primary,
      matchLogic: currentNode.logic.map((item) => ({
        ...item,
        _id: createNewMongooseId(),
      })),
    };
    await this.callAiForExecutingLogics(requestBody);

    // this.variablesInFlow = {
    //   ...this.variablesInFlow,
    //   [currentNode.storeAsVariable]: derivedValue,
    // };
    if (currentNode.next) {
      const node = this.getNextNodeDetailsFromFlow(tree, currentNode.next);
      return this.triggerNextNodeData(node, tree);
    }
    return true;
  }

  getKeys(keys = [], mapping) {
    // console.log("variables,mappingvariables,mapping", keys, mapping)
    const v = keys.map(k => ({ [k.exportKey || k.key]: mapping[k.key] }))
    const m = {}
    v.forEach(o => {
      m[Object.keys(o)[0]] = Object.values(o)[0]
    })
    // console.log("mmmmmmmmmmmmmmmmmmmmmmmm,vvvvvvvvvvvvvvvvvvvvvvvvvvvvvv", m, v)
    return mapping
  }

  async writeJsonIntoExcelFile(data, batchId) {
    try {
      await createXcelFile(data, batchId)
      return true;
    } catch (err) {
      return false;
    }
  }

  fecthVariablesInWorkflows(batchId) {
    return new Promise((resolve) => {
      auto({
        batch: (cb) => {
          idpService.findOne({ _id: batchId }, { workflowId: 1 }, null, null, cb)
        },
        workflow: ['batch', ({ batch }, cb) => {
          workflowService.findOne({ _id: batch.workflowId }, { variablesInFlow: 1, outputJSON: 1 }, null, null, cb);
        }]
      }, (err, { workflow }) => {
        // console.log("WORKFLOW USED IS", workflow);
        resolve(workflow)
      })
    })
  }

  titleCase(str = "") {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  async createMappingOld(nextNode, tree, batchId, generateNow = null) {
    const docs = await this.fetchDocumentsWrtBatch(batchId);
    let variablesInFlowDoc = this.variablesInFlow;
    let outputJSON = { source: 'excel' }
    const workflow = await this.fecthVariablesInWorkflows(batchId);
    if (workflow) {
      if (workflow.variablesInFlow) {
        variablesInFlowDoc = workflow && workflow.variablesInFlow;
      }
      if (workflow.outputJSON) {
        outputJSON = workflow.outputJSON
      }
    }
    if (generateNow) {
      outputJSON = generateNow // { source: 'excel' } //
    }
    const xCelMapping = []
    const xCelMappingTable = [];
    docs.forEach(document => {
      // extract key value
      // check for data present
      if (!document.pageArray) {
        return
      }
      // eslint-disable-next-line no-unused-vars
      document.pageArray.forEach(({ tabularContent = {}, nonTabularContent = [] }) => {
        // extract key value data
        let finalMapping = {}
        nonTabularContent.forEach((field) => {
          const value = (field && field.local_value) || {}
          field.global_key_title = this.titleCase(field.global_key)
          finalMapping = {
            ...finalMapping,
            [field.global_key]: value.edited_value || value.text,
            [field.global_key_title]: value.edited_value || value.text,

          };
        })
        // console.log("finalMappingfinalMappingfinalMapping", finalMapping)
        // eslint-disable-next-line prefer-object-spread
        const docKeyValue = Object.assign({}, document.mapping, { 'Extraction Passed': `${document.isTableFlag && document.isNonTableFlag}`, 'Feedback Given': `${document.isFeedbackApplied}` }, finalMapping)
        let docType = document.docType
        const ocr = variablesInFlowDoc.ocr.filter(d => docKeyValue['Document type'] && docKeyValue['Document type'].toLowerCase() === d.documentType.toLowerCase());// condition will be changed
        let v = [{ exportKey: 'Document name' }, { exportKey: 'Extraction Passed' }, { exportKey: 'Feedback Given' }, { exportKey: "file_id" }, { exportKey: "Page Range" }];
        v = v.map(k => ({ ...k, key: k.key || k.exportKey }))
        const vs = !ocr[0] ? [] : ocr[0].variables.filter(v => v.selected) // .map(v => v.exportKey || v.key);
        v.push(...vs)
        const xc = xCelMapping.filter(d => d.type === docType);
        if (xc.length) {
          xc[0].data.push({ ...this.getKeys(v, docKeyValue), file_id: document.externalId, "Page Range": document.pageRange });
        } else {
          xCelMapping.push({ type: docType, data: [{ ...this.getKeys(v, docKeyValue), file_id: document.externalId, "Page Range": document.pageRange }] })
        }

        docType = `${docType}_table_data`;
        // // extract table data

        // tabularContentOriginal.forEach((e) => {
        //   const { cell_info = null } = e;
        //   if (!cell_info || !ocr[0] || !ocr[0].columns || !ocr[0].columns.length) {
        //     return
        //   }
        //   const tableHeader = {};
        //   const newTableHeader = {};
        //   const tableColumns = ['Document name'].concat(ocr[0].columns);
        //   tableColumns.forEach(c => {
        //     tableHeader[c] = '';
        //     newTableHeader[c] = c;
        //   })
        //   newTableHeader['file_id'] = "file_id"
        //   newTableHeader["Page Range"] = "Page Range"

        //   const xct = xCelMappingTable.filter(d => d.type === docType);
        //   const tableData = cell_info.map(row => {
        //     const data = {}
        //     row.forEach(e => {
        //       Object.keys(tableHeader).forEach(th => {
        //         data[th] = e.column === th ? e.text : data[th] || docKeyValue[th] || ''
        //       })
        //     })
        //     data.file_id = document.externalId
        //     data["Page Range"] = document.pageRange
        //     return data
        //   }).filter(o => Object.keys(o).length)
        //   if (xct.length) {
        //     xct[0].data.push(tableHeader)
        //     xct[0].data.push(newTableHeader)
        //     xct[0].data.push(...tableData);
        //   } else {
        //     xCelMappingTable.push({ type: docType, data: tableData })
        //   }
        // })
        tabularContent.forEach((e) => {
          const { cell_info: data = null } = e;
          if (!data) {
            return
          }
          const tableHeader = {};
          const newTableHeader = {};
          const tableColumns = ['Document name'].concat(document.table_columns);
          tableColumns.forEach(c => {
            tableHeader[c] = '';
            newTableHeader[c] = c;
          })
          newTableHeader['file_id'] = "file_id"
          newTableHeader["Page Range"] = "Page Range"

          const xct = xCelMappingTable.filter(d => d.type === docType);
          const tableData = data.map(row => {
            const data = {}
            row.forEach(e => {
              if (e) {
                Object.keys(tableHeader).forEach(th => {
                  data[th] = e.column === th ? e.text : data[th] || docKeyValue[th] || ''
                })
              }
            })
            data.file_id = document.externalId
            data["Page Range"] = document.pageRange
            return data
          }).filter(o => Object.keys(o).length)
          if (xct.length) {
            xct[0].data.push(tableHeader)
            xct[0].data.push(newTableHeader)
            xct[0].data.push(...tableData);
          } else {
            xCelMappingTable.push({ type: docType, data: tableData })
          }
        })
      })
    })
    console.log("xCelMappingTable", JSON.stringify(xCelMappingTable));
    // console.log("xCelMappingTemp", JSON.stringify(xCelMapping));
    let fileSaved;
    if (outputJSON.source === 'excel') {
      fileSaved = await this.writeJsonIntoExcelFile(xCelMapping.concat(xCelMappingTable), batchId);
      console.log("outputJSON", outputJSON)
      // * Update to step 3 ///Direc to step 3 ; to stop fething the same document  when no action need
    } else if (outputJSON.source === 'webhook' && outputJSON.webhookId) {
      fileSaved = await sendDataToAPI(xCelMapping.concat(xCelMappingTable), batchId, outputJSON.webhookId)
    } else if (outputJSON.externalDbConfigId) {
      fileSaved = await sendDataToExternalDb(xCelMapping.concat(xCelMappingTable), batchId, outputJSON.webhookId)
    }
    if (fileSaved && !generateNow) {
      await idpService.update({ _id: batchId }, { $set: { step: 3 } })
    }
    // this.variablesInFlow = {
    //   ...this.variablesInFlow,
    //   finalMapping,
    // };
    // const node = this.getNextNodeDetailsFromFlow(tree, currentNode.next);
    // console.log("OCR DONE tree", node)
    // return await this.triggerNextNodeData(node, tree, batchId);
  }

  async createMapping(nextNode, tree, batchId, generateNow = null) {
    const docs = await this.fetchDocumentsWrtBatch(batchId);
    let variablesInFlowDoc = this.variablesInFlow;
    let outputJSON = { source: 'excel' }
    const workflow = await this.fecthVariablesInWorkflows(batchId);
    if (workflow) {
      if (workflow.variablesInFlow) {
        variablesInFlowDoc = workflow && workflow.variablesInFlow;
      }
      if (workflow.outputJSON) {
        outputJSON = workflow.outputJSON
      }
    }
    if (generateNow) {
      outputJSON = generateNow // { source: 'excel' } //
    }
    const xCelMapping = []
    const xCelMappingTable = [];
    docs.forEach(document => {
      // extract key value
      // check for data present
      if (!document.pageArray) {
        return
      }
      // eslint-disable-next-line no-unused-vars
      let finalMapping = {}
      document.pageArray.forEach(({ tabularContent = [], nonTabularContent = [] }) => {
        // extract key value data
        nonTabularContent.forEach((field) => {
          const value = (field && field.local_value) || {}
          field.global_key_title = this.titleCase(field.global_key)
          finalMapping = {
            ...finalMapping,
            [field.global_key]: value.edited_value || value.text,
            [field.global_key_title]: value.edited_value || value.text,

          };
        });
        let docType = document.docType
        docType = `${docType}_table_data`;
        tabularContent.forEach((e) => {
          const { cell_info: data = null } = e;
          if (!data) {
            return
          }
          const tableHeader = {};
          const newTableHeader = {};
          const tableColumns = ['Document name'].concat(document.table_columns);
          tableColumns.forEach(c => {
            tableHeader[c] = '';
            newTableHeader[c] = c;
          })
          newTableHeader['file_id'] = "file_id"
          newTableHeader["Page Range"] = "Page Range"

          const xct = xCelMappingTable.filter(d => d.type === docType);
          const tableData = data.map(row => {
            const data = {}
            row.forEach(e => {
              if (e) {
                Object.keys(tableHeader).forEach(th => {
                  data[th] = e.column === th ? e.text : data[th] || ''
                })
              }
            })
            data.file_id = document.externalId
            data["Page Range"] = document.pageRange
            return data
          }).filter(o => Object.keys(o).length)
          if (xct.length) {
            xct[0].data.push(tableHeader)
            xct[0].data.push(newTableHeader)
            xct[0].data.push(...tableData);
          } else {
            xCelMappingTable.push({ type: docType, data: tableData })
          }
        })
      })
      const xc = xCelMapping.filter(d => d.type === document.docType);
      if (xc.length) {
        xc[0].data.push({ ...finalMapping, file_id: document.externalId, "Page Range": document.pageRange });
      } else {
        xCelMapping.push({ type: document.docType, data: [{ ...finalMapping, file_id: document.externalId, "Page Range": document.pageRange }] })
      }
    })
    console.log("nontabular content", JSON.stringify(xCelMapping))
    console.log("xCelMappingTable", JSON.stringify(xCelMappingTable));
    let fileSaved;
    if (outputJSON.source === 'excel') {
      fileSaved = await this.writeJsonIntoExcelFile(xCelMapping.concat(xCelMappingTable), batchId);
      console.log("outputJSON", outputJSON)
      // * Update to step 3 ///Direc to step 3 ; to stop fething the same document  when no action need
    } else if (outputJSON.source === 'webhook' && outputJSON.webhookId) {
      fileSaved = await sendDataToAPI(xCelMapping.concat(xCelMappingTable), batchId, outputJSON.webhookId)
    } else if (outputJSON.externalDbConfigId) {
      fileSaved = await sendDataToExternalDb(xCelMapping.concat(xCelMappingTable), batchId, outputJSON.webhookId)
    }
    if (fileSaved && !generateNow) {
      await idpService.update({ _id: batchId }, { $set: { step: 3 } })
    }
    // this.variablesInFlow = {
    //   ...this.variablesInFlow,
    //   finalMapping,
    // };
    // const node = this.getNextNodeDetailsFromFlow(tree, currentNode.next);
    // console.log("OCR DONE tree", node)
    // return await this.triggerNextNodeData(node, tree, batchId);
  }

  _documentsExtractViaAI(batchId, hcb) {
    auto({
      UNPROCESS_DOCUMENTS: (cb) => {
        documentService.findAll({
          isDeleted: false,
          idpId: batchId,
          aiStatus: { $in: [AI_STATUS.FEEDBACK_PENDING] },
        }, {}, null).then((result) => {
          if (result && result.length) {
            cb(null, result);
          } else {
            cb("no data to process");
          }
        }).catch(err => {
          if (err) {
            CONSOLE.error(err)
          }
          cb(err)
        });
      },
      mappedUnprocessedDocuments: ['UNPROCESS_DOCUMENTS', (result, cb) => {
        _customiseDocumentsForProcessing(result.UNPROCESS_DOCUMENTS).then((result) => {
          if (result && result.length) {
            cb(null, result)
          } else {
            cb("no data to process")
          }
        }).catch(err => {
          if (err) {
            CONSOLE.error(err)
          }
          cb(err)
        });
      }],
    }, (err, { mappedUnprocessedDocuments }) => {
      if (err) {
        return hcb(err);
      }
      if (mappedUnprocessedDocuments && mappedUnprocessedDocuments.length) {
        CONSOLE.info(`No of documents processing with AI on ${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}: ${mappedUnprocessedDocuments.length} `);
        _processAiOnDocuments(mappedUnprocessedDocuments).then(result => {
          hcb(null, result)
        }).catch(err => hcb(err));
      }
    })
  }

  async fetchOcr(currentNode, tree, batchId) {
    await new Promise((resolve, reject) => {
      this._documentsExtractViaAI(batchId, (err) => {
        // to do SET STATUS feedback;
        if (err && err !== "no data to process") {
          CONSOLE.error(err)
          return reject(err);
        }
        this.changeStatus(batchId, (err, result) => {
          if (err) {
            CONSOLE.error(err)
            return reject(err);
          }
          return resolve(result)
        })
      })
    })
    // if (currentNode.next) {
    // console.log("OCR DONE", currentNode,)
    const node = this.getNextNodeDetailsFromFlow(tree, currentNode.next);
    // console.log("OCR DONE tree", node)
    return this.triggerNextNodeData(node, tree, batchId);
    // }
  }

  changeStatus(batchId, hcb) {
    auto({
      BATCH: (cb) => {
        idpService.findOne({ _id: batchId }, cb)
      },
      WORKFLOW: ['BATCH', ({ BATCH }, cb) => {
        workflowService.findOne({ _id: BATCH.workflowId }, cb)
      }],
      UPDATE_BATCH: ['BATCH', "WORKFLOW", ({ BATCH, WORKFLOW }, cb) => {
        // idpService.update({},)
        const OCR_PERCENT = (BATCH.ocrPassedCount / BATCH.filesCount) * 100;
        console.log("BATCH, OCR_PERCENT", BATCH.idpId, OCR_PERCENT);
        if ((BATCH.ocrPassedCount + BATCH.ocrFailedCount) === BATCH.filesCount) {
          const data = { step: 6, threshold: OCR_PERCENT, ocrStatus: 'COMPLETED' }
          if (OCR_PERCENT >= WORKFLOW.threshold) {
            // checkfor feedback status change
            if (BATCH.classes && BATCH.classes.length) {
              const classes = BATCH.classes || []
              for (let i = 0; i < classes.length; i++) {
                const bClass = classes[i]; // bClass ===class
                if (bClass.bucketId === 'class1') {
                  if (bClass.count > 0) {
                    data.feedbackStatusNewFormat = "PENDING"
                  } else if (bClass.feedbackCount > 0) {
                    data.feedbackStatusNewFormat = "COMPLETED";
                  }
                }
                if (bClass.bucketId === 'class2') { // Key Value failure
                  if (bClass.count > 0) {
                    data.feedbackStatusFieldNotFound = "PENDING"
                  } else if (bClass.feedbackCount > 0) {
                    data.feedbackStatusFieldNotFound = "COMPLETED"
                  }
                }
                if (bClass.bucketId === 'class3') { // No Table Detection
                  if (bClass.count > 0) {
                    data.feedbackStatusTableNotDetected = "PENDING"
                  } else if (bClass.feedbackCount > 0) {
                    data.feedbackStatusTableNotDetected = "COMPLETED"
                  }
                }
              }
            }
            // * Update to step 2 //
            data.step = 6;
            // TODO change OCR  status of the batch
          }
          idpService.update({ _id: batchId }, { $set: data }, () => {
            cb(null, true)
          });
        } else {
          console.log("OCR DOESNT MEET THRESHOLD",)
          cb(null, true)
        }
      }],
    }, (err) => {
      if (err) {
        console.log("ERROR 373", err)
        return hcb(err)
      }
      return hcb(null, true)
    })
  }

  getNextNodeDetailsFromFlow(tree, nodeName) {
    // console.log("NODEEEEEE", tree[nodeName])
    let nextNode = null;
    if (tree.hasOwnProperty(nodeName)) {
      nextNode = tree[nodeName];
    } else {
      // console.log('Noode does not exist');
      return null;
    }
    return nextNode;
  }

  async triggerNextNodeData(nextNode, tree, batchId = null) {
    switch (nextNode.nodeType) {
      case 'RULE_DO_OCR':
        console.log('fetching OCR...');
        await this.fetchOcr(nextNode, tree, batchId);
        break;
      case 'RULE_LOGICAL_COMPARISION':
        console.log('creating comparision...');
        await this.createMapping(nextNode, tree, batchId);
        break;
      case 'RULE_CREATE_CUSTOM_MAPPING':
        console.log('creating custom mapping...');
        await this.logicalComparison(nextNode, tree);
        break;
      case 'WORKFLOW_END':
        console.log('I am last node...WORKFLOW_END');
        break;
      default:
        break;
    }
    return true
  }

  async startDecisionTree(batchId = null, workflowId = null) {
    try {
      // [TODO] - will be
      let { input = {}, backendJSON = {} } = mockDecisionTreeUseCase1;
      // fetting workflow details
      // if ("6256c8c1b5085ca30245700e" != workflowId) {
      //   return 0
      // }
      let workflow = {}
      if (workflowId) {
        workflow = await workflowService.findOne({ _id: workflowId });
        if (workflow) {
          backendJSON = workflow.backendJSON
          input = (backendJSON && backendJSON.input) || {}
        } else {
          console.log(`workflow id ${workflowId} not found for batch`, batchId);
          await idpService.deleteMany({ _id: batchId })
          await documentService.deleteMany({ idpId: batchId })
        }
      }
      // FOR DEFAULT WORKFLOWS only used with demo for backend compatiblity
      // if(!backendJSON){
      //   await this.triggerNextNodeData({nodeType:'RULE_DO_OCR}, {}, batchId);
      // }
      // decision tree start
      this.workflowTree = backendJSON || {};
      this.currentStep = 1;
      if (!Object.keys(backendJSON).length) {
        throw BoomCustomError(400, { message: 'No workflow found' });
      }
      this.variablesInFlow = {
        ...workflow.variablesInFlow,
        batchId,
        workflowId,
        primary: input.primary,
        docs: [],
        validDocs: Object.keys(input).filter((item) => item !== 'primary'),
      };
      const nodeName = backendJSON.dt.startNode.next;
      const tree = { ...backendJSON.dt };
      delete tree.startNode;
      const node = this.getNextNodeDetailsFromFlow(tree, nodeName);
      // console.log("I AM HERR")
      // [TODO] nextNode.nodeType  == RULE_DO_OCR and step == 0
      await this.triggerNextNodeData(node, tree, batchId);
      // Create mapping
      // const finalMapping = await this.createMapping(output);
      // console.log('OUTPUT', finalMapping);
      // return true;
      return this.variablesInFlow
    } catch (err) {
      console.error(err);
      throw BoomCustomError(400, { message: err.message });
    }
  }
}

module.exports = new DecisionTreeController();
