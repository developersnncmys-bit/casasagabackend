const Suite = require('../models/Suite');
const Addon = require('../models/Addon');
const Booking = require('../models/Booking');
const ApiError = require('../helpers/ApiError');

const DAY = 86400000;
const nightsBetween = (a, b) => (a && b && b > a ? Math.round((new Date(b) - new Date(a)) / DAY) : 0);

// Statuses that actually hold the room
const HOLDING = ['confirmed', 'checked-in'];

/**
 * Checks the suite and add-ons exist and works out the total the same way the
 * website's booking form does: nights × nightly price + priced add-ons.
 */
async function prepare(data) {
  const suite = await Suite.findById(data.suite);
  if (!suite) throw ApiError.badRequest('Choose a suite that exists');

  const ids = Array.isArray(data.addons) ? [...new Set(data.addons)] : [];
  const addons = ids.length ? await Addon.find({ _id: { $in: ids } }) : [];
  const nights = nightsBetween(data.checkIn, data.checkOut);
  const total = nights * (suite.price || 0) + addons.reduce((t, a) => t + (a.price || 0), 0);

  return { ...data, addons: addons.map((a) => a._id), total };
}

/** Stops two confirmed stays in the same suite on overlapping nights. */
async function assertAvailable(data, excludeId) {
  if (!HOLDING.includes(data.status)) return;
  const clash = await Booking.findOne({
    _id: { $ne: excludeId },
    suite: data.suite,
    status: { $in: HOLDING },
    checkIn: { $lt: data.checkOut },
    checkOut: { $gt: data.checkIn },
  });
  if (clash) {
    throw ApiError.conflict(`${clash.name} (${clash.ref}) already has this suite from ${clash.checkIn} to ${clash.checkOut}`);
  }
}

module.exports = { prepare, assertAvailable, nightsBetween };
