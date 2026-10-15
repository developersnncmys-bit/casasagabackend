const mongoose = require('mongoose');
const toJSON = require('../helpers/toJSON');

const galleryImageSchema = new mongoose.Schema(
  {
    src: { type: String, required: [true, 'Add an image'] },
    cat: { type: String, required: true, trim: true },
    alt: { type: String, required: [true, 'Describe the photo'], trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

toJSON(galleryImageSchema);

module.exports = mongoose.model('GalleryImage', galleryImageSchema);
