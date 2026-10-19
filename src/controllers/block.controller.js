const Block = require('../models/Block');
const { crud } = require('../helpers/crud');

// Blocked dates, soonest first
module.exports = crud(Block, { name: 'Blocked dates', sort: { from: 1 } });
