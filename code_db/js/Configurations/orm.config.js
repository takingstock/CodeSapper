const mongoose = require('mongoose');

const config = require('config');

const db = (server) => new Promise((resolve, reject) => {
  const mongooseConfig = config.get('EVENTS.MONGOOSE');
  const MONGODB_URI = process.env.MONGODB_URI || config.get('MONGODB_URI');
  try {
    mongoose.connect(
      process.env.MONGODB_URI || MONGODB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useFindAndModify: false,
        useCreateIndex: true,
      },
    );

    // When successfully connected
    mongoose.connection.on(mongooseConfig.CONNECTED, () => {
      server.log(['test', 'database', 'success'], `DB Connected in ${process.env.NODE_ENV || 'LOCAL'} mode with ${process.env.MONGODB_URI || MONGODB_URI}`);
      resolve();
    });

    // If the connection throws an error
    mongoose.connection.on(mongooseConfig.ERROR, (err) => {
      server.log(['test', 'database', 'error'], `Mongoose default connection error: ${err}`);
      reject(err);
    });

    // When the connection is disconnected
    mongoose.connection.on(mongooseConfig.DISCONNECTED, () => {
      server.log(['test', 'database', 'error'], 'Mongoose default connection disconnected');
      return reject(new Error('Mongoose default connection disconnected'));
    });
  } catch (_) {
    server.log(['test', 'database', 'error'], 'MONGO_URI not defined OR issue in connecting via MONGO_URI...');
    process.exit(1);
  }
});

module.exports = db;
