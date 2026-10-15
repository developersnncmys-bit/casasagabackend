const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');
const { BOOKING_SOURCES, BOOKING_STATUSES } = require('../config/constants');

const isDay = /^\d{4}-\d{2}-\d{2}$/;

const bookingSchema = new mongoose.Schema(
  {
    ref: { type: String, unique: true, index: true },
    name: { type: String, required: [true, "Enter the guest's name"], trim: true },
    phone: { type: String, required: [true, 'Enter a phone number'], trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    // Suite and add-on ids are their slugs ("tulum", "birthday")
    suite: { type: String, ref: 'Suite', required: [true, 'Choose a suite'] },
    // Dates are plain YYYY-MM-DD days, as the booking form sends them
    checkIn: { type: String, required: true, match: [isDay, 'Use a YYYY-MM-DD date'] },
    checkOut: {
      type: String,
      required: true,
      match: [isDay, 'Use a YYYY-MM-DD date'],
      validate: { validator(v) { return !this.checkIn || v > this.checkIn; }, message: 'Check-out must be after check-in' },
    },
    guests: { type: Number, min: 1, max: 10, default: 2 },
    addons: [{ type: String, ref: 'Addon' }],
    occasion: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
    source: { type: String, enum: BOOKING_SOURCES, default: 'website' },
    // Worked out by the server from the suite price and add-ons
    total: { type: Number, default: 0 },
  },
  { timestamps: true },
);

bookingSchema.index({ suite: 1, checkIn: 1 });

bookingSchema.pre('validate', function setRef(next) {
  if (!this.ref) this.ref = 'CS' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
  next();
});

toJSON(bookingSchema);

module.exports = mongoose.model('Booking', bookingSchema);
