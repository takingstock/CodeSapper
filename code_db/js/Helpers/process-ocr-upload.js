const config = require('config');
const path = require('path');
const { eachSeries, auto, mapSeries } = require('async');
const mappingController = require('../Controllers/mapping.controller');
const syncAiResponseController = require('../Controllers/syncAiResponse.controller')
const { documentService } = require('../Services');
const { _blankBucketResponse } = require('../Controllers/document.controller')
const { _customizeBucketResoonse } = require('./bucket');
const AI_ENDPOINTS = require('../Utils/ai-endpoints.util');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const ImcAPIEndPoints = require('../Utils/imc-endpoints.util');
const { _customizeOcrResponse } = require('./ocr');

const appPathDir = path.join(__dirname, '../../', 'uploads/');
const AI_STATUS = config.get('AI_STATUS');
const APP_EVENTS = config.get('APP_EVENTS');
const SOCKET_EVENTS = config.get('SOCKET_EVENTS');

const syncBatch = async (idpDataToUpdate) => new Promise(async (resolve) => {
    syncAiResponseController.syncBatchByOcrCB(
        idpDataToUpdate, (err) => {
            if (!err) {
                console.log("BAtch synced");
            }
            resolve(true)
        }
    );
})
const __syncDocumentAndBatch = async (batchId, ocrResponse) => {
    await syncAiResponseController.syncDocumentsByOcrCB(ocrResponse);
    if (ocrResponse.socketType === SOCKET_EVENTS.OCR_DOCUMENT) {
        // PUBLISH_AI_STATUS_DOCUMENTS(socket, tenantId, ocrResponse);
        const idpDataToUpdate = {
            idpId: batchId,
            isOCrPassed: AI_STATUS.OCR_DONE === ocrResponse.aiStatus,
            isOcrFailed: AI_STATUS.OCR_FAILED === ocrResponse.aiStatus,
            isIdentified: ocrResponse.isTableFlag && ocrResponse.isNonTableFlag,
        };
        // update counter in batch data
        await syncBatch(idpDataToUpdate);
    }
}
const customiseDocumentsForProcessing = async (
    mappedSavedDocuments,
) => new Promise((resolve, reject) => {
    const result = [];
    eachSeries(mappedSavedDocuments, (file, cb) => {
        if (file.aiStatus === AI_STATUS.OCR_PENDING) {
            result.push([file]);
            cb(null, [file]);
        }
    }, (err) => {
        if (err) {
            return reject(err);
        }
        return resolve(result && result.flat());
    });
});

/**
 * mapped ocr response wrt uploaded docs
 * @param {Object} file
 * @param {String} configId
 * @returns
 */
const processDocOcr = async (file) => {
    const {
        tenantId, pageNo = 1, idpId: batchId, opType = null, _id: documentId,
        fileOriginalName: docName = null, filePath = null, _id: docId = null, externalCustomerId = null
    } = file;
    const configId = file.configId || null;
    let ocrResponse = null;
    try {
        let ocrError = null
        ocrResponse = await AI_ENDPOINTS.processOcr({
            path: `${appPathDir}${filePath}`,
            tenantId,
            documentId: docId,
            docName,
            processOcrUpload: true,
            externalCustomerId
        });
        if (ocrResponse.hasOwnProperty('error') && ocrResponse.error) {
            ocrError = ocrResponse.error;
        }
        if (ocrResponse.hasOwnProperty('error') && ocrResponse.error === '[AI]--OUTPUT_FAILURE'
            && ocrResponse.hasOwnProperty("errorCode") && ocrResponse.errorCode === 1) {
            ocrResponse = {
                ...ocrResponse,
                corruptFile: true
            }
        }
        // { "processStart" : "FAILURE", "error" : "[AI]--OUTPUT_FAILURE", "errorCode" : 1 } // TODO WEBHOOK if(ai response in progress)
        ocrResponse = _customizeOcrResponse(ocrResponse);
        ocrResponse = {
            ...ocrResponse,
            // create mapping from the response
            mapping: await mappingController.mappingOcrFields(
                configId,
                { ...ocrResponse },
                file,
            ),
        };

        // data to send
        ocrResponse = {
            opType,
            tenantId,
            batchId,
            documentId,
            pageNo,
            ...ocrResponse,
            socketType: opType === 'PROCESSING' ? SOCKET_EVENTS.OCR_DOCUMENT : SOCKET_EVENTS.OCR_TRAINING_DOCUMENT,
        }

        // data to send
        EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, ocrResponse);
        await __syncDocumentAndBatch(batchId, ocrResponse)
        return ({ ...ocrResponse, error: ocrError || null });
    } catch (err) {
        ImcAPIEndPoints.sendEmail({
            apiTarget: 'PLATFORM',
            subject: `AI_BUGS | IDP | ${process.env.NODE_ENV}`,
            body: JSON.stringify({
                environment: process.env.NODE_ENV_LABEL || process.env.NODE_ENV,
                apiType: 'DOCUMENT_OCR',
                tenantId,
                documentId,
                response: ocrResponse,
                err: err.message,
            }),
            filePath: `${appPathDir}${filePath}`,
        }).then(() => { }).catch(() => { });
        const mapping = await mappingController.mappingOcrFields(
            configId,
            { aiStatus: AI_STATUS.OCR_FAILED, type: null },
            file,
        );
        ocrResponse = {
            opType,
            tenantId,
            batchId,
            documentId,
            pageNo,
            aiStatus: AI_STATUS.OCR_FAILED,
            docType: null,
            mapping
        }
        await __syncDocumentAndBatch(batchId, ocrResponse);
        EMIT_EVENT(APP_EVENTS.AI_ERROR, {
            type: AI_STATUS.OCR_FAILED,
            err: err.message || AI_STATUS.OCR_FAILED,
            docId: documentId,
        });
        return ({ ...ocrResponse, error: err });
    }
};

/* eslint-disable arrow-body-style */
const processAiOnDocuments = async (
    mappedSavedDocuments
) => new Promise((resolve) => {
    mapSeries(mappedSavedDocuments, (file, cb) => {
        return processDocOcr(file).then((f) => cb(null, f));
    }, (err, result) => {
        if (err) {
            console.log("SOMETHING WENT WRONG", err);
            return resolve(false);
        }
        return resolve(result);
    });
});

const documentsBucketization = ({ tenantId }, { apiBatch }, hcb) => {
    auto({
        payload: (cb) => {
            documentService.findAll(
                {
                    corruptFile: false,
                    tenantId,
                    apiBatch,
                    $or: [
                        {
                            isNonTableFlag: false,
                        },
                        {
                            isTableFlag: false,
                        },
                    ],
                },
                null,
                null,
                cb
            );
        },
        mappedPayload: ['payload', ({ payload = [] }, cb) => {
            const mappedPayload = payload.map((item) => {
                const { pageArray = [] } = item;
                const mappedPageArray = pageArray && pageArray.map((page) => ({
                    doc_id: item._id.toString(),
                    ocr_output_path: page.ocr_output_link,
                }));
                return mappedPageArray;
            }).flat().filter((item) => item);
            cb(null, mappedPayload)
        }],
        bucketing: ['mappedPayload', ({ mappedPayload }, cb) => {
            if (!mappedPayload.length) {
                return cb(null, _blankBucketResponse());
            }
            AI_ENDPOINTS.processBucketing(tenantId, {
                tenantId,
                processed_docs: mappedPayload,
            }).then(response => cb(null, response)).catch(e => cb(e))
        }],
        documents: ['bucketing', ({ bucketing }, cb) => {
            const customizedBuckets = _customizeBucketResoonse(bucketing);
            const documents = customizedBuckets.map((bucket) => {
                const { buckets = [] } = bucket;
                return buckets.map((doc) => ({
                    ...doc,
                    bucketId: bucket.bucketId,
                    bucketName: bucket.name,
                }));
            }).flat();
            cb(null, documents)
        }],
        updateDocuments: ['documents', ({ documents }, cb) => {
            mapSeries(documents, (doc, mcb) => {
                documentService.update(
                    { _id: doc.docId },
                    {
                        $push: {
                            buckets: {
                                isTaggedAsTrainingDoc: doc.isTrainingDoc,
                                bucketId: doc.bucketId,
                                bucketName: doc.bucketName,
                                bucketCategory: doc.docCategory,
                                isFeedbackAppliedOn: false,
                            },
                        },
                    },
                    { new: true },
                    mcb
                );
            }, cb);
        }]
    }, (err, { updateDocuments }) => {
        if (err) {
            console.log("BUCKET AI ERROR", err)
            return hcb({
                data: _blankBucketResponse(),
                error: `[AI]: ${err.message}`,
            });
        }
        hcb(null, { documents: updateDocuments })
    })
};

module.exports = {
    processAiOnDocuments,
    customiseDocumentsForProcessing,
    documentsBucketization
}
