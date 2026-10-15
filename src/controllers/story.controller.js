const Story = require('../models/Story');
const { crud } = require('../helpers/crud');

module.exports = crud(Story, { name: 'Story' });
