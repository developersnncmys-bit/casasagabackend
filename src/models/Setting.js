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
    },
    policies: [{ _id: false, label: String, value: String }],
    occasions: [String],
    values: [{ _id: false, title: String, text: String }],
    galleryCategories: [String],
    // Printed on invoices
    invoice: {
      businessName: { type: String, default: 'CasaSaga' },
      gstin: { type: String, default: '' },
      // % added on top of the stay; 0 = no tax line
      taxRate: { type: Number, min: 0, max: 100, default: 0 },
      // Added to every booking: a fixed ₹ amount, or a % of the base fee (rate × nights)
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
