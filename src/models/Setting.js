const mongoose = require('mongoose');

/** Site-wide details — one document, key "site". */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'site', unique: true },
    contact: {
      address: [String],
      phone: String,
      tel: String,
      whatsapp: String,
      mapUrl: String,
      instagram: String, // Instagram page link, for the "Follow us" button
    },
    policies: [{ _id: false, label: String, value: String }],
    occasions: [String],
    values: [{ _id: false, title: String, text: String }],
    // Cancellation & refund policy page: one titled point each
    refundPolicy: [{ _id: false, title: String, text: String }],
    galleryCategories: [String],
    // Instagram reel links shown on the home page
    reels: [String],
    // The properties, e.g. Banashankari 6th Stage and JP Nagar 7th Phase
    locations: [
      {
        _id: false,
        id: { type: String, required: true, trim: true, lowercase: true },
        name: { type: String, required: true, trim: true },
        address: [String],
        mapUrl: { type: String, default: '' },
        // What the website's embedded map searches for: an address or "lat,lng"
        mapQuery: { type: String, default: '' },
      },
    ],
    // Printed on invoices
    invoice: {
      businessName: { type: String, default: 'CasaSaga' },
      gstin: { type: String, default: '' },
      // % added on top of the stay; 0 = no tax line
      taxRate: { type: Number, min: 0, max: 100, default: 0 },
      // Added to online bookings after GST: a % of the total, or a fixed ₹ amount
      // GST % on decoration add-ons without their own rate
      addonTaxRate: { type: Number, min: 0, max: 100, default: 18 },
      convenienceFee: { type: Number, min: 0, default: 0 },
      convenienceFeeType: { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
      prefix: { type: String, default: 'CS' },
      note: { type: String, default: 'Thank you for celebrating with us at CasaSaga.' },
    },
  },
  { timestamps: true },
);

settingSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret._id;
    delete ret.__v;
    delete ret.key;
    return ret;
  },
});

/** The single settings document, created empty the first time. */
settingSchema.statics.get = async function get() {
  return (await this.findOne({ key: 'site' })) || this.create({ key: 'site' });
};

module.exports = mongoose.model('Setting', settingSchema);
