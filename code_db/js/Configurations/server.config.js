const dotenv = require('dotenv');
const config = require('config');
const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const Joi = require('joi');
const HapiSwagger = require('hapi-swagger');
const Nes = require('@hapi/nes');
const path = require('path');
const AuthBearer = require('hapi-auth-bearer-token');

dotenv.config(); // set environment variables
const db = require('./orm.config');
const routes = require('../Routes');
const hapiJsLogger = require('./hapijs-logger.config');
const { bootstrapSeedData } = require('../Utils/bootsrap-seed.util');
const { bootstrapVendorToDb } = require('../Utils/bootstrap-vendors.util');
const { bootstrapPrivateKey } = require('../Utils/bootstrap-config.util');
const { fetchCustomersFromId } = require('../Plugins/custom_plugins');
const { authSimpleStrategy, authApiStrategy, authApiKeyStrategy } = require('../Utils/auth-strategy.util');
// const { LOG_APPLICATION_ACTIVITY_ERRORS } = require('../Utils/logger.util');
const REGISTER_SOCKET_TOPICS = require('../Utils/socket-topic.util');
const { CRON_HANDLERS } = require('../Controllers/cron.controller');
const CONSOLE = require('../Utils/console-log.util');
const COMMUNICATION_BRIDGE = require('../Controllers/communication-bridge');
const Pack = require('../package.json');
const { validationErrorHandler } = require('../Utils/validation-error-handler.util');

const serverConfig = config.get('SERVER');
const nodeConfig = config.get('EVENTS.NODE');
const envConfig = config.get('ENV');
const AUTH_STRATEGIES = config.get('AUTH_STRATEGIES');
// Hapi-Js server config
const server = Hapi.server({
  port: process.env.PORT || serverConfig.PORTS.HAPI,
  host: process.env.HOST || serverConfig.HOST,
  routes: {
    cors: true,
    validate: {
      failAction: validationErrorHandler
    },
    files: {
      relativeTo: path.join(__dirname, '../../', 'uploads'),
    },
  },
  debug: process.env.NODE_ENV !== envConfig.PROD ? { request: ['error'] } : false,
});

// Define Authentication strategy
const setUpAuthStrategy = async () => {
  await server.register(AuthBearer);
  server.auth.strategy(AUTH_STRATEGIES.SIMPLE, 'bearer-access-token', {
    allowMultipleHeaders: true,
    accessTokenName: 'accessToken',
    validate: authSimpleStrategy,
  });
  server.auth.strategy(AUTH_STRATEGIES.API_AUTH, 'bearer-access-token', {
    allowMultipleHeaders: true,
    accessTokenName: 'accessToken',
    validate: authApiStrategy,
  });
  server.auth.strategy(AUTH_STRATEGIES.API_KEY_AUTH, 'bearer-access-token', {
    allowMultipleHeaders: true,
    allowQueryToken: true,
    accessTokenName: 'api-key',
    validate: authApiKeyStrategy,
  });
  server.ext(fetchCustomersFromId)
};

// setup routes, logger, data validator
const setUpRoutes = async () => {
  hapiJsLogger(server);
  server.validator(Joi);
  server.route(routes);
};

// setup socket via HapiJs - NES
const setupSocket = async () => {
  // register nes socket
  await server.register({
    plugin: Nes,
    options: {
      auth: {
        type: 'direct',
        route: AUTH_STRATEGIES.API_AUTH,
      },
      heartbeat: {
        interval: 15 * 1000,
        timeout: 10 * 1000,
      },
      onConnection: (socket) => {
        // console.log(socket.auth.credentials.user);
        if (socket?.auth?.credentials?.user?.email) {
          CONSOLE.info(`Socket Connected: ${socket?.auth?.credentials?.user?.email}`);
        }
      },
      onDisconnection: (socket) => {
        if (socket?.auth?.credentials?.user?.email) {
          CONSOLE.info(`Socket Disconnected: ${socket?.auth?.credentials?.user?.email}`);
        }
      },
      onMessage: (socket, mesage) => {
        if (mesage) {
          CONSOLE.info(`${socket?.auth?.credentials?.user?.email} says: ${mesage}`);
        }
      },
    },
  });
  REGISTER_SOCKET_TOPICS(server);
};

// swagger setup
const setUpSwagger = async () => {
  const swaggerOptions = {
    info: {
      title: serverConfig.API_TITLE,
      version: Pack.version,
    },
    grouping: serverConfig.GROUPING,
    schemes: serverConfig.SCHEMES,
    securityDefinitions: {
      jwt: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
      },
    },
    security: [{ jwt: [] }],
  };
  await server.register([
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: swaggerOptions,
    },
  ]);
};

const setUpSmartLogger = async () => {
  await server.register({
    plugin: require('hapi-smart-logs'),
    options: {}
  })
};

// bootsrap keys && Data
const setupPrivateKey = async () => new Promise((resolve) => {
  bootstrapPrivateKey((err) => {
    process.emit('LOAD_PUBLIC_KEY');
    process.emit('LOAD_PRIVATE_KEY');
    if (err) {
      console.log('error in bootstrap', err)
      // LOG_APPLICATION_ACTIVITY_ERRORS(
      //   null,
      //   err,
      //   'Issue in bootstrapping keys',
      // );
    }
    return resolve();
  });
});

// will be used for unit testing
const init = async () => {
  server.initialize();
  return server;
};

// Hapi-Js server
const start = async () => {
  await setUpAuthStrategy();
  console.log(",,,,,,,,,,,,,,", process.env.PORT, serverConfig.PORTS.HAPI)
  await setupSocket();

  await setUpSwagger();

  await setUpSmartLogger();

  await setUpRoutes();

  await db(server);
  // await bootstrapVendorToDb();
  // await bootstrapSeedData(server);
  await setupPrivateKey();
  await server.start();

  // eslint-disable-next-line no-console
  server.log(['test', 'success'], `${serverConfig.TEXT} ${server.info.uri}`);
  // start internal cron mechanism for cr process
  CRON_HANDLERS();
  COMMUNICATION_BRIDGE(server);
  return server;
};

const stop = async (serverInstance) => {
  if (serverInstance) {
    await serverInstance.stop({ timeout: 10000 }).then(() => {
      CONSOLE.info(`Server stopped at ${serverInstance.info.uri}`);
      return true;
    })
      .catch((err) => {
        CONSOLE.error(err);
      });
  }
};

module.exports = {
  init,
  start,
  stop,
};

process.on(nodeConfig.UN_HANDLED_REJECTION, (err) => {
  // LOG_APPLICATION_ACTIVITY_ERRORS(
  //   null,
  //   err,
  //   nodeConfig.UN_HANDLED_REJECTION,
  // );
  console.error("unhandled_rejections>>>", err)
  if (process.env.NODE_ENV === envConfig.TEST) {
    process.exit(1);
  }
});
process.on('uncaughtException', (err) => {
  // LOG_APPLICATION_ACTIVITY_ERRORS(
  //   null,
  //   err,
  //   'uncaughtException',
  // );
  console.error("uncaughtException>>>", err)
  if (process.env.NODE_ENV === envConfig.TEST) {
    process.exit(1);
  }
});
