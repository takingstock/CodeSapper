const moment = require('moment');
const path = require('path');
const { once } = require('events');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');

const dateFormat = 'YYYY-MM-DD HH:mm:ss A';

const applicationLogs = (hcb) => {
  const logPath = path.join(__dirname, '../../', '/logs');
  const logFile = `${logPath}/app-error.log`;
  try {
    const array = [];
    const rl = createInterface({
      input: createReadStream(logFile),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      let parsedLine = JSON.parse(line);
      if ('time' in parsedLine) {
        parsedLine = {
          ...parsedLine,
          time: moment(parsedLine.time).format(dateFormat),
        };
      }
      array.push(parsedLine);
    });

    return once(rl, 'close')
      .then(() => hcb(null, {
        data: array.reverse(),
        count: array.length,
      }));
  } catch (err) {
    return hcb('Error in generating logs');
  }
};

module.exports = {
  applicationLogs,
};
