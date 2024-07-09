const EventEmitter = require('events');

const eventEmitter = new EventEmitter();

const LISTEN_EVENT = (event, cb) => {
  eventEmitter.on(event, (data) => {
    cb(data);
  });
};

const EMIT_EVENT = (event, data) => {
  eventEmitter.emit(event, data);
};

module.exports = {
  EMIT_EVENT,
  LISTEN_EVENT,
};
