const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');
const { BOOKING_SOURCES, BOOKING_STATUSES, PAYMENT_MODES } = require('../config/constants');

const isDay = /^\d{4}-\d{2}-\d{2}$/;

// Add-ons as they were priced for this booking — later price changes don't alter it
const addonItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    // null = price still to be agreed ("Price on request")
    price: { type: Number, default: null, min: 0 },
    // GST % on this add-on
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    ref: { type: String, unique: true, index: true },
    name: { type: String, required: [true, "Enter the guest's name"], trim: true },
    phone: { type: String, required: [true, 'Enter a phone number'], trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    // Suite and add-on ids are their slugs ("tulum", "birthday")
    suite: { type: String, ref: 'Suite', required: [true, 'Choose a suite'] },
    suiteName: { type: String, default: '' },
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
    addonItems: [addonItemSchema],
    occasion: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
    source: { type: String, enum: BOOKING_SOURCES, default: 'website' },

    // Pricing — worked out by the server (see services/booking.service.js)
    rate: { type: Number, min: 0, default: 0 }, // nightly price agreed for this stay
    nights: { type: Number, default: 0 },
    roomTotal: { type: Number, default: 0 },
    addonTotal: { type: Number, default: 0 },
    convenienceFee: { type: Number, min: 0, default: 0 }, // online bookings: added after GST, not taxed
    online: { type: Boolean, default: false }, // made on the website
    discount: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    addonTaxAmount: { type: Number, default: 0 }, // part of taxAmount that is GST on add-ons
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    // Payment
    amountPaid: { type: Number, min: 0, default: 0 },
    paymentMode: { type: String, enum: PAYMENT_MODES, default: '' },

    // Timeline
    confirmedAt: Date,
    checkedInAt: Date,
    checkedOutAt: Date,
    cancelledAt: Date,

    // Invoice — numbered the first time one is issued
    invoiceNo: { type: String, unique: true, sparse: true },
    invoiceDate: Date,
  },
  { timestamps: true },
);

bookingSchema.index({ suite: 1, checkIn: 1 });

bookingSchema.pre('validate', function setRef(next) {
  if (!this.ref) this.ref = 'CS' + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 36).toString(36).toUpperCase();
  next();
});

toJSON(bookingSchema);
// toJSON() above turns virtuals off; the balance is useful to every client
const transform = bookingSchema.get('toJSON').transform;
bookingSchema.set('toJSON', {
  virtuals: false,
  transform: (doc, ret) => ({
    ...transform(doc, ret),
    balance: Math.max(Math.round(((ret.total || 0) - (ret.amountPaid || 0)) * 100) / 100, 0),
  }),
});

module.exports = mongoose.model('Booking', bookingSchema);
