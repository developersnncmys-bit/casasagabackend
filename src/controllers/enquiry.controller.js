const Enquiry = require('../models/Enquiry');
const { crud } = require('../helpers/crud');

module.exports = crud(Enquiry, { name: 'Enquiry', sort: { createdAt: -1 } });
