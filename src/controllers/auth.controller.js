const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

const sign = (admin) => jwt.sign({ sub: String(admin._id) }, jwtSecret, { expiresIn: jwtExpiresIn });

exports.login = catchAsync(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw ApiError.badRequest('Enter your email and password');

  const admin = await Admin.findOne({ email }).select('+password');
  if (!admin || !(await admin.checkPassword(password))) throw ApiError.unauthorized('Incorrect email or password');

  admin.lastLoginAt = new Date();
  await admin.save();
  res.json({ success: true, data: { token: sign(admin), admin } });
});

exports.me = catchAsync(async (req, res) => {
  res.json({ success: true, data: req.admin });
});

exports.changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) throw ApiError.badRequest('The new password needs at least 8 characters');

  const admin = await Admin.findById(req.admin._id).select('+password');
  if (!(await admin.checkPassword(String(currentPassword || '')))) throw ApiError.badRequest('Your current password is not right');

  admin.password = String(newPassword);
  await admin.save();
  res.json({ success: true, data: { token: sign(admin) } });
});
