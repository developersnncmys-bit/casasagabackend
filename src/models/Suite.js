const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');

/**
 * A room on the website. `_id` is the URL slug ("tulum") so links like
 * /rooms/tulum and bookings that reference a suite stay readable.
 */
const suiteSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    name: { type: String, required: [true, 'Give the suite a name'], trim: true },
    mood: { type: String, trim: true, default: '' },
    tag: { type: String, trim: true, default: '' },
    price: { type: Number, required: [true, 'Enter the nightly price'], min: 0 },
    img: { type: String, required: [true, 'Add a main photo'] },
    accent: { type: String, default: '#d8b56a' },
    size: { type: String, default: '' },
    guests: { type: String, default: '' },
    // How many rooms of this suite type exist — that many stays can overlap
    inventory: { type: Number, min: 1, max: 50, default: 1 },
    blurb: { type: String, default: '' },
    story: { type: String, default: '' },
    features: [{ type: String, trim: true }],
    amenities: [{ type: String, trim: true }],
    gallery: [String],
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

toJSON(suiteSchema);

module.exports = mongoose.model('Suite', suiteSchema);
