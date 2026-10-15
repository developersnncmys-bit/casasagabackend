const Booking = require('../models/Booking');
const { crud } = require('../helpers/crud');
const { prepare, assertAvailable } = require('../services/booking.service');

const base = crud(Booking, {
  name: 'Booking',
  sort: { createdAt: -1 },
  beforeCreate: (data) => ({ status: 'confirmed', source: 'phone', ...data }),
  beforeSave: async (data, req, doc) => {
    const next = await prepare(data);
    await assertAvailable(next, doc?._id);
    // The total is always the server's own figure
    return { ...next, guests: Number(next.guests) || 2 };
  },
});

module.exports = base;
