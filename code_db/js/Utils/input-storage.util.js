const { auto, eachLimit } = require('async');
const fs = require('fs');
const path = require('path')
const INPUT_STORAGE = require('../Models/input-storage-model');

const addWorkflowToInputSource = (inputJSON, wokflowId, callback) => {
    INPUT_STORAGE.updateOne({ _id: inputJSON._id }, { $set: { wokflowId } }, callback)
}
/* ............................. VERIFY DIRECTORIES....................................  */
const verifyLocalDirectory = (storage, callback) => {
    const data = {}
    if (fs.existsSync(storage.folderPath)) {
        data.status = "VERIFIED"
        data.lastTestResponse = { data: 'Directory exists!', status: 200 }
    } else {
        data.status = "NOT_VERIFIED"
        data.lastTestResponse = { error: 'Directory not found.', status: 404 }
    }
    INPUT_STORAGE.findOneAndUpdate({ _id: storage._id }, { $set: data }, callback)
}
const verifyS3 = (storage, callback) => {
    callback(null, storage)
}
const verifyBlob = (storage, callback) => {
    callback(null, storage)
}
const verifyDirectory = (storage, callback) => {
    switch (storage.type) {
        case "LOCAL":
            verifyLocalDirectory(storage, callback);
            break;
        case "S3":
            verifyS3(storage, callback);
            break;
        case "BLOB":
            verifyBlob(storage, callback);
            break;
        default:
            console.log("Input storage not found");
            callback(null, null);
    }
}

/* ............................. READING FILES....................................  */
const getFileFromLocalStorage = ({ folderPath, workflowId: configId }, callback) => {
    const dataToSend = { configId }
    fs.readdir(folderPath, (err, files) => {
        // handling error
        if (err) {
            return console.log('Unable to scan directory: ', err);
        }
        // listing all files using forEach
        eachLimit(files, 1, (file, cb) => {
            // Do whatever you want to do with the file
            fs.createReadStream(`${folderPath}/${file}`);
            const pathToSave = path.join(__dirname, '../', '/uploads/downloads/local');
            const fileName = `${file}`;
            // fsXtra.ensureDir(pathToSave).then((res) => {
            const fileOutput = fs.createWriteStream(`/${pathToSave}/${fileName}`);
            fileOutput.on('close', cb);
            fileOutput.on('error', () => cb(null, null));
            console.log(file);
            // })
        }, (err, files) => {
            dataToSend.files = files.filter(e => e)
            callback(null, dataToSend)
        });
    });
}
// getFileFromLocalStorage({ folderPath: '/home/auqib/Downloads/multi_page' }, () => {

// })
const getFileFromS3 = (storage, callback) => {
    callback(null, storage)
}

const getFileFromBlob = (storage, callback) => {
    callback(null, storage)
}
const getFile = (storage, callback) => {
    switch (storage.type) {
        case "LOCAL":
            getFileFromLocalStorage(storage, callback);
            break;
        case "S3":
            getFileFromS3(storage, callback);
            break;
        case "BLOB":
            getFileFromBlob(storage, callback);
            break;
        default:
            console.log("Input storage not found");
            callback(null, null);
    }
}

const startReadingInputStorage = (callback) => {
    auto({
        storages: (cb) => {
            INPUT_STORAGE.find({ status: "VERIFIED" }, cb)
        },
        getFiles: ['storage', ({ storages }, cb) => {
            eachLimit(storages, 3, (storage, ecb) => {
                getFile(storage, ecb)
            }, cb)
        }]
    }, (e, r) => {
        if (e) {
            console.log("Error while fetching input storage: ", e)
        }
        callback(e, r)
    })
}
module.exports = {
    startReadingInputStorage,
    verifyDirectory,
    addWorkflowToInputSource
}
