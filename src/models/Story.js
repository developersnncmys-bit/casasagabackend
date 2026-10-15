const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');

/** A guest review shown on the home page. */
const storySchema = new mongoose.Schema(
  {
    names: { type: String, required: [true, 'Add the guest names'], trim: true },
    occasion: { type: String, default: '' },
    quote: { type: String, required: [true, 'Add what they said'], trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

toJSON(storySchema);

module.exports = mongoose.model('Story', storySchema);
