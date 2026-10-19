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
    // Guests: the price covers includedGuests; each guest beyond that pays extraGuestPrice a night; maxGuests at most
    includedGuests: { type: Number, min: 1, max: 10, default: 2 },
    maxGuests: { type: Number, min: 1, max: 10, default: 4 },
    extraGuestPrice: { type: Number, min: 0, default: 0 },
    // Offer on the base fee: discountValue % off, or ₹ off per night ('flat'); 0 = none.
    // discountUntil (YYYY-MM-DD, optional) = last check-in date it applies to
    discountType: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    discountValue: { type: Number, min: 0, default: 0 },
    discountLabel: { type: String, trim: true, maxlength: 40, default: '' },
    discountUntil: { type: String, default: '' },
    // How many rooms of this suite type exist — that many stays can overlap
    inventory: { type: Number, min: 1, max: 50, default: 1 },
    // Which property the suite is at — an id from Settings → locations (e.g. "banashankari")
    location: { type: String, trim: true, default: 'banashankari' },
    // GST % for this suite; null = the default in Settings → Invoices & pricing
    taxRate: { type: Number, min: 0, max: 100, default: null },
    blurb: { type: String, default: '' },
    story: { type: String, default: '' },
    features: [{ type: String, trim: true }],
    amenities: [{ type: String, trim: true }],
    gallery: [String],
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    // Shown in the home page's suites section (the rest are on the Suites page)
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

toJSON(suiteSchema);

module.exports = mongoose.model('Suite', suiteSchema);
