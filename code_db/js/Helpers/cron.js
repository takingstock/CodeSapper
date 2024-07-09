const { auto } = require('async');
const config = require('config');
const { eachSeries } = require('async');
const imcController = require('../Controllers/imc.controller');
const ocrAiController = require('../Controllers/ocr-ai.controller');
const feedbackAiController = require('../Controllers/feedback-ai.controller');
const { documentService } = require('../Services');
const { EMIT_EVENT } = require('../Utils/data-emitter.util');
const { createMongooseId } = require('../Utils/universal-functions.util');

const APP_EVENTS = config.get('APP_EVENTS');
const AI_STATUS = config.get('AI_STATUS');
const FEEDBACK_TYPES = config.get('FEEDBACK_TYPES');

const _createUserFeedbackWrtFeedbackApi = (arr) => arr
    .filter((field) => (!!(field?.local_key?.edited_key) || !!(field?.local_value?.edited_value)))
    .map((field) => ({
        global_key: field.global_key,
        data_type: field.data_type || null,
        mandatory: field.mandatory || false,
        recon: typeof (field.recon) === 'boolean' ? field.recon : null,
        // [TODO] required - if frontend supports multline contoring
        local_key: [{
            pts: field?.local_key?.pts || [],
            text: field?.local_key?.edited_key,
        }],
        // [TODO] required - if frontend supports multline contoring
        local_value: [{
            pts: field?.local_value?.pts || [],
            text: field?.local_value?.edited_value,
        }],
    }));

const _createAiGeneratedKeysWrtFeedbackApi = (arr) => arr.map((field) => ({
    global_key: field.global_key,
    data_type: field.data_type || null,
    mandatory: field.mandatory || false,
    recon: typeof (field.recon) === 'boolean' ? field.recon : null,
    // [TODO] required - if frontend supports multline contoring
    local_key: [{
        pts: field?.local_key?.ocr_pts || [],
        text: field?.local_key?.text,
    }],
    // [TODO] required - if frontend supports multline contoring
    local_value: [{
        pts: field?.local_value?.ocr_pts || [],
        text: field?.local_value?.text,
    }],
}));

const _createGlobalMappingWrtFeedbackApi = (arr) => arr
    .map((item) => item.keys.map((key) => key.key)).flat();

const _createRequestWrtFeedbackApi = async (file, isTrainingSet = false) => {
    console.log('_createRequestWrtFeedbackApi', file, 'isTrainingSet', isTrainingSet)
    return new Promise((resolve, reject) => {
        auto({
            globalMapping: (cb) => {
                imcController.mappingFetchIMC(
                    {
                        tenantId: file.tenantId,
                        docType: file.docType,
                    },
                    (err, response) => {
                        if (err) {
                            return cb(err);
                        }
                        return cb(null, response);
                    },
                )
            },
            docGlobalMapping: ['globalMapping', (result, cb) => {
                // result.globalMapping
                console.log('result 73>>', result);
                const docGlobalMapping = _createGlobalMappingWrtFeedbackApi(result.globalMapping);
                console.log('docGlobalMapping', docGlobalMapping);
                const { pageArray = [] } = file;
                const mappedFeedbackArray = pageArray
                    .filter((item) => (
                        !isTrainingSet
                            ? (item.isNonTabularFeedbackRequested)
                            : true
                    ))
                    .map((item) => {
                        const { nonTabularContent = [] } = item;
                        const mappedNonTabularContent = _createUserFeedbackWrtFeedbackApi(nonTabularContent);
                        const feedback = {
                            tenantId: file.tenantId,
                            doc_id: file._id.toString(),
                            doc_name: file.fileOriginalName,
                            dimension: item.dimension || {},
                            page_no: item.pageNo,
                            ocr_link: item.ocr_link,
                            ocr_output_path: item.ocr_output_link,
                            document_category: file.docType,
                            global_keys_in_document_caterory: docGlobalMapping,
                            ai_generated_key_values: _createAiGeneratedKeysWrtFeedbackApi(nonTabularContent),
                        };
                        if (!isTrainingSet) {
                            return {
                                ...feedback,
                                user_feedback: mappedNonTabularContent,
                                feedbackType: FEEDBACK_TYPES.NON_TABULAR,
                                opType: file.opType,
                                batchId: file.idpId,
                                bucketId: file.bucketId,
                                buckets: file.buckets || [],
                            };
                        }
                        return feedback;
                    });
                console.log('mappedFeedbackArray', mappedFeedbackArray)
                if (mappedFeedbackArray && mappedFeedbackArray.length) {
                    return cb(null, mappedFeedbackArray);
                }
                return cb("empty array");
            }]
        }, (err, result) => {
            if (err) {
                reject(err)
            } else {
                resolve(result.docGlobalMapping)
            }
        })
    });
    // const globalMapping = await imcController.mappingFetchIMC(
    //   {
    //     tenantId: file.tenantId,
    //     docType: file.docType,
    //   },
    // );//
};

const _createUserFeedbackWrtTabularFeedbackApi = (arr) => arr
    .map((item) => item.map((i) => ({
        pts: i?.pts || [],
        text: i?.text || '',
    }))).flat();

const _createRequestWrtTabularFeedbackApi = async (file, isTrainingSet = false) => {
    const { pageArray = [] } = file;
    const mappedFeedbackArray = pageArray
        .filter((item) => (
            !isTrainingSet
                ? (item.isTabularFeedbackRequested)
                : true
        ))
        .map((item) => {
            console.log('inside 147>>>')
            const { tabularContent = {}, tabularContentOriginal = {} } = item;
            const mappedtabularContentData = _createUserFeedbackWrtTabularFeedbackApi(
                tabularContent.data || [],
            );
            const feedback = {
                tenantId: file.tenantId,
                doc_id: file._id.toString(),
                doc_name: file.fileOriginalName,
                page_no: item.pageNo,
                ocr_link: item.ocr_link,
                ocr_output_path: item.ocr_output_link,

                document_category: file.docType,
                table_content: tabularContentOriginal,
            };
            if (!isTrainingSet) {
                return {
                    ...feedback,
                    user_feedback: {
                        ocr_cell_info: mappedtabularContentData,
                        table_bounds: tabularContent.tableBoundaries || [],
                        row_vector_additions: tabularContent.row_vector_additions || [],
                        row_vector_removals: tabularContent.row_vector_removals || [],
                        column_vector_additions: tabularContent.column_vector_additions || [],
                        column_vector_removals: tabularContent.column_vector_removals || [],
                    },
                    opType: file.opType,
                    batchId: file.idpId,
                    bucketId: file.bucketId,
                    buckets: file.buckets || [],
                    feedbackType: FEEDBACK_TYPES.TABULAR,
                };
            }
            return feedback;
        });
    console.log('returning mappedFeedbackArray', mappedFeedbackArray)
    return mappedFeedbackArray;
};

const _createTrainingSetWrtBucketId = async (page) => {
    console.log('_createTrainingSetWrtBucketId 186 called>>.')
    const {
        batchId, buckets, feedbackType, doc_id: docId, bucketId,
    } = page;
    const bucketForTraining = buckets.find(
        (item) => !item.isTaggedAsTrainingDoc && item.bucketId === bucketId,
    );
    if (!bucketForTraining) {
        return [];
    }
    const criteria = {
        idpId: batchId,
        buckets: {
            $elemMatch: {
                bucketId,
                bucketCategory: bucketForTraining?.bucketCategory,
            },
        },
        _id: { $ne: docId },
    };
    const trainingDocuments = await documentService.findAll(criteria);
    let trainingSet = [];
    console.log('trainingDocuments length', trainingDocuments.length, 'feedbackType', feedbackType)
    if (feedbackType === 'TABULAR') {
        trainingSet = await Promise.all(trainingDocuments.map(async (file) => {
            const mappedFeedbackArray = await _createRequestWrtTabularFeedbackApi(file, true);
            console.log('mappedFeedbackArray 212', mappedFeedbackArray)
            return mappedFeedbackArray;
        }));
        console.log('trainingSet 214>>>', trainingSet)
        return trainingSet;
    }
    trainingSet = await Promise.all(trainingDocuments.map(
        async (file) => {
            const mappedFeedbackNonTabArray = await _createRequestWrtFeedbackApi(file, true);
            return mappedFeedbackNonTabArray;
        }
    ));
    return trainingSet.flat();
};

const createNonTabularFeedback = (file) => _createRequestWrtFeedbackApi(file)
    .then(
        (mappedFeedbackArray) => Promise.all(mappedFeedbackArray
            .map((item) => _createTrainingSetWrtBucketId(item)
                .then(
                    (trainingSet) => {
                        console.log("0000000000000000000000000000")
                        return ({
                            ...item,
                            opType: file.opType,
                            aiStatus: file.aiStatus,
                            trainingSet,
                        })
                    },
                ))),
    ).catch(() => {
        return ([])
    });

const createTabularFeedback = (file) => _createRequestWrtTabularFeedbackApi(file)
    .then(
        (mappedFeedbackArray) => Promise.all(mappedFeedbackArray
            .map((item) => _createTrainingSetWrtBucketId(item)
                .then(
                    (trainingSet) => {
                        return ({
                            ...item,
                            opType: file.opType,
                            aiStatus: file.aiStatus,
                            trainingSet,
                        })
                    },
                )))
    );

const _customiseDocumentsForProcessing = async (
    mappedSavedDocuments,
) => new Promise((resolve, reject) => {
    const result = []
    // console.log('259>>mappedSavedDocuments',mappedSavedDocuments.length)
    eachSeries(mappedSavedDocuments, (file, cb) => {
        // console.log("mappedSavedDocuments", file.aiStatus)

        if (file.aiStatus === AI_STATUS.OCR_PENDING) {
            result.push([file]);
            cb(null, [file]);
        } else {
            console.log("268>>>", file.aiStatus)
            Promise.all([
                createNonTabularFeedback(file),
                createTabularFeedback(file),
            ]).then(([mappedFeedbackArrayWithTraining, mappedTabularFeedbackArrayWithTraining]) => {
                // console.log("bbbbbbbbbbbggggggggggggggggggggggggggggggggggggggggggggggggggggg",file.aiStatus, mappedFeedbackArrayWithTraining, 'mappedTabularFeedbackArrayWithTraining',mappedTabularFeedbackArrayWithTraining)
                result.push([...mappedFeedbackArrayWithTraining, ...mappedTabularFeedbackArrayWithTraining])
                cb(null, [...mappedFeedbackArrayWithTraining, ...mappedTabularFeedbackArrayWithTraining])
            }).catch((error) => {
                console.log('error is ', error)
            });
        }
    }, (err, mappedData) => {
        console.log("mappedData", err, result.length, mappedData)
        if (err) {
            return reject(err);
        }
        return resolve(result && result.flat());
    });
});

const _processAiOnDocuments = async (
    mappedSavedDocuments
) => new Promise((resolve) => {
    eachSeries(mappedSavedDocuments, (file, cb) => {
        if (file.aiStatus === AI_STATUS.OCR_PENDING) {
            return ocrAiController.processDocOcr(file).then(() => cb());
        }
        if (file.aiStatus === AI_STATUS.FEEDBACK_PENDING) {
            if (file.feedbackType && file.feedbackType === FEEDBACK_TYPES.NON_TABULAR) {
                // console.log("file.aiStatus 0", file.feedbackType && file.feedbackType === FEEDBACK_TYPES.NON_TABULAR)
                return feedbackAiController.processFeedback(file).then(() => cb()).catch(() => cb());
            }
            if (file.feedbackType && file.feedbackType === FEEDBACK_TYPES.TABULAR) {
                // console.log('inside 314>>>>',file)
                return feedbackAiController.processTabularFeedback(file).then(() => cb()).catch(() => cb());
            }
        }
        return cb();
    }, async (err) => {
        if (err) {
            return resolve(false);
        }
        return resolve(true);
    });
});

/**
 * release File review Lock after N time
 * @param {*} callback
 */
const releaseUnnecessaryFileLock = (callback) => {
    const dateBefore = new Date(new Date().getTime() - (1000 * 60 * 30)) // lock added before 30 minutes
    const criteria = { reviewStartedLockAt: { $exists: true, $nin: [null], $lt: dateBefore } }
    const dataToSet = { reviewStartedLockBy: null, reviewStartedLockAt: null }
    const files = {}
    auto({
        docs: (cb) => {
            documentService.findAll(criteria, { fileName: 1, idpId: 1, tenantId: 1, reviewStartedLockBy: 1 }, { limit: 10, offset: 0 }, cb);
        },
        updateFiles: ['docs', ({ docs }, cb) => {
            if (!(docs && docs.length)) {
                return cb(null, false)
            }
            const docIds = []
            docs.forEach(d => {
                files[d.fileName] = d
                docIds.push(createMongooseId(d._id))
            })
            const criteria = { _id: { $in: docIds } }
            documentService.updateAll(criteria, { $set: dataToSet }, null, cb)
        }],
    }, (err, { docs }) => {
        if (err) {
            console.log("ERROR releaseUnnecessaryFileLock", err)
        }
        if (docs) {
            const tenants = {} // {tenantId:data}
            Object.values(files).forEach(file => {
                const eventData = {
                    type: `BATCH_AUTO_RELEASE`,
                    userId: file.reviewStartedLockBy,
                    idpId: file.idpId
                }
                EMIT_EVENT("SAVE_USER_ACTION", eventData);
                if (!tenants[file.tenantId]) {
                    tenants[file.tenantId] = [{ fileName: file.fileName, idpId: file.idpId }]
                } else {
                    tenants[file.tenantId].push({ fileName: file.fileName, idpId: file.idpId })
                }
            })
            Object.keys(tenants).forEach(tenantId => {
                EMIT_EVENT(APP_EVENTS.REFRESH_BATCHES, { opType: "REFRESH", tenantId, eventType: "RELEASE_FILE", data: tenants[tenantId] });
            })
        }
        callback(null, true)
    })
}

module.exports = {
    _customiseDocumentsForProcessing,
    _processAiOnDocuments,
    releaseUnnecessaryFileLock
};
