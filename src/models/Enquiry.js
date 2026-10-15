const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');
const { ENQUIRY_STATUSES } = require('../config/constants');

/** A message from the website's contact form. */
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Enter a name'], trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    occasion: { type: String, default: '' },
    message: { type: String, required: [true, 'Enter the message'], trim: true },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'new', index: true },
  },
  { timestamps: true },
);

enquirySchema.pre('validate', function needsContact(next) {
  if (!this.email && !this.phone) this.invalidate('email', 'Add an email or phone number');
  next();
});

toJSON(enquirySchema);

module.exports = mongoose.model('Enquiry', enquirySchema);
