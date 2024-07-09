// [TODO] - will be used in future for error handling throught the application
// for better error handling
class CustomError extends Error {
  constructor(message, ...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }

    this.name = 'CustomError';
    // Custom debugging information
    this.message = message;
    this.status = 400;
    this.date = new Date();
  }
}

module.exports = CustomError;
