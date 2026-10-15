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
