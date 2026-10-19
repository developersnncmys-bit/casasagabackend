const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');

const isDay = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Dates closed to bookings (maintenance, private use…). Covers the nights from `from` to `to`,
 * both included. Applies to the listed suites, or every suite at `location`, or — with neither —
 * every suite. `rooms` closes only that many rooms of each (e.g. 2 of 6 flats).
 */
const blockSchema = new mongoose.Schema(
  {
    from: { type: String, required: [true, 'Choose the first blocked night'], match: [isDay, 'Use a YYYY-MM-DD date'] },
    to: {
      type: String,
      required: [true, 'Choose the last blocked night'],
      match: [isDay, 'Use a YYYY-MM-DD date'],
      validate: { validator(v) { return !this.from || v >= this.from; }, message: "The last night can't be before the first" },
    },
    suites: [{ type: String, trim: true }],
    location: { type: String, trim: true, default: '' },
    // How many rooms of each covered suite to close (flats have several); empty = all of them
    rooms: { type: Number, min: 1, max: 50, default: null },
    reason: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true },
);

blockSchema.index({ from: 1, to: 1 });

/** Does this block cover the suite? */
blockSchema.methods.covers = function covers(suite) {
  if (this.suites?.length) return this.suites.includes(suite._id || suite.id);
  if (this.location) return suite.location === this.location;
  return true;
};

toJSON(blockSchema);

module.exports = mongoose.model('Block', blockSchema);
