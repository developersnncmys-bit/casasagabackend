const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');

/** An in-house decoration package. `_id` is a slug ("birthday") used in /booking?addon=… links. */
const addonSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
    no: { type: String, default: '' },
    title: { type: String, required: [true, 'Give the add-on a name'], trim: true },
    occasion: { type: String, default: '' },
    text: { type: String, default: '' },
    img: { type: String, required: [true, 'Add a photo'] },
    // null = "Price on request"
    price: { type: Number, default: null, min: 0 },
    // GST % for this add-on; null = the add-on default in Settings → Invoices & pricing
    taxRate: { type: Number, min: 0, max: 100, default: null },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

toJSON(addonSchema);

module.exports = mongoose.model('Addon', addonSchema);
