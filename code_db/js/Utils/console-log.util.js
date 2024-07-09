/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
const chalk = require('chalk');

const {
  green, red, cyanBright, yellowBright,
} = chalk.bold;

const CONSOLE = {
  success(message) {
    return console.log(green(message));
  },
  error(message) {
    return console.log(red(message));
  },
  warning(message) {
    return console.log(cyanBright(message));
  },
  info(message) {
    return console.log(yellowBright(message));
  },
};

module.exports = CONSOLE;
