const GalleryImage = require('../models/GalleryImage');
const { crud } = require('../helpers/crud');

module.exports = crud(GalleryImage, { name: 'Photo' });
