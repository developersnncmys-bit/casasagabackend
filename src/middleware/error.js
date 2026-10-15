const multer = require('multer');
const ApiError = require('../helpers/ApiError');
const { isProduction } = require('../config/env');

function notFound(req, res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

/** Turns anything thrown into one shape: { success: false, message, details? } */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    error = new ApiError(400, details[0]?.message || 'Some fields are not right', details);
  }
  if (err.name === 'CastError') error = ApiError.badRequest(`${err.value} is not a valid ${err.path}`);
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    error = ApiError.conflict(field === '_id' ? 'That URL name is already used' : `That ${field} is already taken`);
  }
  if (err.name === 'JsonWebTokenError') error = ApiError.unauthorized('Your session is not valid — sign in again');
  if (err.name === 'TokenExpiredError') error = ApiError.unauthorized('Your session has expired — sign in again');
  if (err instanceof multer.MulterError) {
    error = ApiError.badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 8 MB or smaller' : err.message);
  }
  if (err.type === 'entity.parse.failed') error = ApiError.badRequest('The request body is not valid JSON');

  const statusCode = error.statusCode || 500;
  const body = { success: false, message: statusCode === 500 ? 'Something went wrong at our end' : error.message };
  if (error.details) body.details = error.details;
  if (!isProduction && statusCode === 500) body.stack = err.stack;
  if (statusCode === 500) console.error(err);

  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
