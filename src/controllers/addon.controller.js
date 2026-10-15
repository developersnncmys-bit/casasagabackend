const Addon = require('../models/Addon');
const { crud } = require('../helpers/crud');
const { uniqueSlug } = require('../helpers/slug');

const base = crud(Addon, {
  name: 'Add-on',
  beforeCreate: async (data, req) => {
    const count = await Addon.countDocuments();
    return {
      ...data,
      _id: await uniqueSlug(Addon, req.body.id || data.title, 'addon'),
      no: data.no || String(count + 1).padStart(2, '0'),
    };
  },
  // An empty price means "Price on request"
  beforeSave: (data) => ({ ...data, price: data.price === '' || data.price == null ? null : Number(data.price) }),
});

module.exports = base;
