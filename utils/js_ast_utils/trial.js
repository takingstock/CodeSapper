const espree = require('espree');
const estraverse = require('estraverse');

const code = `
const changeStatus = (batchId, hcb) => {
    auto({
        BATCH: (cb) => {
            idpService.findOne({ _id: batchId }, cb)
        },
        UPDATE_BATCH: ['BATCH', ({ BATCH }, cb) => {
            if (!BATCH) {
                return cb(null, null)
            }
            // console.log("BACKUP>>> changeStatus, changeStatus = changeStatus,", batchId)
            verifyDocumentCount(batchId, true, cb)
        }],
    }, (err) => {
        if (err) {
            console.log("ERROR 373", err)
            return hcb(err)
        }
        // console.log("BATCH updated")
        return hcb(null, true)
    })
}

const saveBackupForBatch = (idpId, callback) => {
    //console.log("BACKUP>>> BACKUP SAVing.....")
    auto({
        checkBackUp: (cb) => {
            BACK_UP.findOne({ idpId }, (e, r) => {
                if (e) {
                    return cb(e)
                }
                if (r) {
                    return cb("backup already exists")
                }
                cb()
            })
        },
        batch: ['checkBackUp', (_, cb) => {
            idpService.findOne({ _id: idpId }, null, null, null, cb)
        }],
        documents: ['checkBackUp', (_, cb) => {
            documentService.findAll({ idpId }, null, null, cb)
        }],
        createIdpBackUp: ['batch', 'documents', ({ documents, batch }, cb) => {
            console.log("BACKUP>>> ready to create backup", idpId)
            new BACK_UP({ idpId, documents, batch }).save(cb)
        }]
    }, (err) => {
        if (err) {
            console.error(err)
        }
        console.log("BACKUP>>> BACKUP SAVED", idpId)
        callback()
    })
}

`;

const ast = espree.parse(code, {
    ecmaVersion: 2021,
    sourceType: 'script'
});

const extractedElements = {
    classes: [],
    methods: [],
    functions: [],
    arrowFunctions: [],
    objectMethods: []
};

estraverse.traverse(ast, {
    enter: (node) => {
        if (node.type === 'ClassDeclaration') {
            extractedElements.classes.push(node.id.name);
        }

        if (node.type === 'MethodDefinition' && node.parent && node.parent.id) {
            extractedElements.methods.push({
                className: node.parent.id.name,
                methodName: node.key.name
            });
        } else if (node.type === 'MethodDefinition') {
            extractedElements.methods.push({
                className: 'Anonymous',
                methodName: node.key.name
            });
        }

        if (node.type === 'FunctionDeclaration') {
            extractedElements.functions.push(node.id.name);
        }

        if (node.type === 'ArrowFunctionExpression' && node.parent && node.parent.type === 'VariableDeclarator') {
            extractedElements.arrowFunctions.push(node.parent.id.name);
        }

        if (node.type === 'Property' && node.value.type === 'FunctionExpression') {
            extractedElements.objectMethods.push(node.key.name);
        }

        if (node.type === 'Property' && node.value.type === 'ArrowFunctionExpression') {
            extractedElements.arrowFunctions.push(node.key.name);
        }
    }
});

console.log('Extracted Elements:', JSON.stringify(extractedElements, null, 2));

