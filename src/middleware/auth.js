const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { jwtSecret } = require('../config/env');

/** Requires a valid `Authorization: Bearer <token>` from the admin panel. */
const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();

  const payload = jwt.verify(token, jwtSecret);
  const admin = await Admin.findById(payload.sub);
  if (!admin) throw ApiError.unauthorized('This account no longer exists');

  req.admin = admin;
  next();
});

module.exports = { protect };
