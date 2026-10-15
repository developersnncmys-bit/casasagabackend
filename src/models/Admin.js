const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const toJSON = require('../helpers/toJSON');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: 'Admin' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

adminSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

toJSON(adminSchema, ['password']);

module.exports = mongoose.model('Admin', adminSchema);
