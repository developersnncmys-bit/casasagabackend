const Suite = require('../models/Suite');
const Booking = require('../models/Booking');
const ApiError = require('../helpers/ApiError');
const catchAsync = require('../helpers/catchAsync');
const { crud } = require('../helpers/crud');
const { slugify } = require('../helpers/slug');

const base = crud(Suite, {
  name: 'Suite',
  // The client picks the URL name (sent as `id`); it becomes the document _id
  beforeCreate: async (data, req) => {
    const id = slugify(req.body.id || data.name);
    if (!id) throw ApiError.badRequest('Enter a URL name for the suite');
    if (await Suite.exists({ _id: id })) throw ApiError.conflict('Another suite already uses this URL name');
    return { ...data, _id: id };
  },
});

exports.list = base.list;
exports.getOne = base.getOne;
exports.create = base.create;
exports.update = base.update;

// Deleting a suite with upcoming stays would leave those bookings pointing at nothing
exports.remove = catchAsync(async (req, res, next) => {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = await Booking.countDocuments({
    suite: req.params.id,
    checkOut: { $gte: today },
    status: { $in: ['pending', 'confirmed', 'checked-in'] },
  });
  if (upcoming) throw ApiError.conflict(`This suite has ${upcoming} upcoming booking${upcoming > 1 ? 's' : ''} — hide it instead, or move those bookings first`);
  return base.remove(req, res, next);
});
