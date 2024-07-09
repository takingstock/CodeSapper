const { Sequelize, DataTypes } = require('sequelize');

const connectSequelize = (dbConfig) => {
    const { dbName, username, password, url, dbType } = dbConfig;
    console.log("DATABASE TO CONNECT IS", dbConfig)
    return new Sequelize(dbName, username, password, {
        host: url,
        dialect: dbType /* one of 'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql' | 'db2' | 'snowflake' | 'oracle' */
    });
}

const createDocument = (sequelize, table_name = "idptestingtable") => {
    // TODO dynamic model from document configurations
    const document = sequelize.define(table_name, {
        document_name: DataTypes.STRING,
        extraction_passed: DataTypes.BOOLEAN,
        feedback_given: DataTypes.BOOLEAN,
        invoice_number: DataTypes.STRING,
        invoice_date: DataTypes.STRING,
        supplier_name: DataTypes.STRING,
        total_invoice_amount: DataTypes.INTEGER,
        total_tax_amount: DataTypes.INTEGER,
        supplier_tax_identification_number: DataTypes.STRING,
        tabular_data: DataTypes.TEXT
    }, {
        tableName: table_name
    });
    // (async () => { await document.sync({ force: true }) })()
    return document
};
const _closeDbCOnnection = (sequelize) => {
    if (sequelize) {
        sequelize.close()
            .then(() => { console.log("dbconnection closed sucess:") })
            .catch((e) => { console.log("dbconnection close failed :", e) })
    }
}

const connection = (config) => new Promise(async (resolve) => {
    let sequelize = null;
    try {
        sequelize = connectSequelize(config)
        await sequelize.authenticate();
        resolve({ sucess: true })
        // console.log('Connection has been established successfully.');
    } catch (error) {
        resolve({ sucess: false, error })
        console.error('Unable to connect to the database:', error);
    } finally {
        // _closeDbCOnnection(sequelize)
    }
})

const create = (config, data) => new Promise(async (resolve, reject) => {
    let sequelize = null;
    try {
        sequelize = connectSequelize(config)
        await sequelize.authenticate();
        const document = await (await createDocument(sequelize, config.tableName)).bulkCreate(data)
        resolve({ sucess: true, document })
    } catch (error) {
        reject(error)
        console.error('Unable to create data in database:', error);
    } finally {
        // _closeDbCOnnection(sequelize)
    }
    console.log("connection test data:", config);
})
const read = (config, query) => new Promise(async (resolve, reject) => {
    let sequelize = null;
    try {
        sequelize = connectSequelize(config)
        const document = await (await createDocument(sequelize, config.tableName)).findAll(query)
        resolve({ sucess: true, document: JSON.stringify(document) })
    } catch (error) {
        reject(error)
        console.error('Unable to read data from database:', config, error);
    } finally {
        // _closeDbCOnnection(sequelize)
    }
    console.log("connection test data:", config);
})
const update = (config, query, data) => new Promise(async (resolve, reject) => {
    let sequelize = null;
    try {
        console.log(data)
        sequelize = connectSequelize(config)
        const document = await (await createDocument(sequelize, config.tableName)).findAll(query)
        resolve({ sucess: true, document })
    } catch (error) {
        reject(error)
        console.error('Unable to update data in database:', config, error);
    } finally {
        _closeDbCOnnection(sequelize)
    }
    console.log("connection test data:", config);
})
const deleteOne = (config, query) => new Promise(async (resolve, reject) => {
    let sequelize = null;
    try {
        sequelize = connectSequelize(config)
        const document = await (await createDocument(sequelize, config.tableName)).deleteOne(query)
        resolve({ sucess: true, document })
    } catch (error) {
        reject(error)
        console.error('Unable to create data in database:', error);
    } finally {
        _closeDbCOnnection(sequelize)
    }
    console.log("connection test data:", config);
})
const testData = () => ({
    document_name: "testing document 1",
    extraction_passed: true,
    feedback_given: true,
    invoice_number: "DataTypes.STRING",
    invoice_date: "DataTypes.STRING",
    supplier_name: "DataTypes.STRING",
    total_invoice_amount: 33,
    total_tax_amount: 33,
    supplier_tax_identification_number: "DataTypes.STRING",
})
// const defaultDb = {
//     url: '4.224.122.63',
//     port: 3306,
//     username: 'root',
//     password: 'amygb',
//     dbName: 'testingschema',
//     dbType: 'mysql'
// }
// const defaultDb = {
//     url: '4.224.122.63',
//     port: 1433,
//     username: 'user_amygb',
//     password: 'Backend_amygb!',
//     dbName: 'db_idp_backend',
//     dbType: 'mssql'
// }
// read(defaultDb, {}).then(r => {
//     console.log("all data read", r)
// }).catch(e => {
//     console.log("reading data fail", e)
// })
// create(defaultDb, [testData(), testData()]).then(r => {
//     console.log("all data", r)
// }).catch(e => {
//     console.log("reading data fail", e)
// })
// connection(defaultDb).then(r => {
//     console.log("connected sucessfully")
// }).catch(e => {
//     console.log("connection failed")
// })
module.exports = {
    connection,
    create,
    read,
    update,
    deleteOne,
    testData
}
