const Suite = require('../models/Suite');
const Addon = require('../models/Addon');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');
const ApiError = require('../helpers/ApiError');
const { HOLDING_STATUSES } = require('../config/constants');

const DAY = 86400000;
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const nightsBetween = (a, b) => (a && b && b > a ? Math.round((new Date(b) - new Date(a)) / DAY) : 0);
const addDays = (d, n) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * For each suite: the most rooms taken on any single night of [checkIn, checkOut),
 * and the bookings involved. A stay fits while that number is below the suite's inventory.
 */
async function occupancy(checkIn, checkOut, { excludeId, suiteId } = {}) {
  const query = {
    status: { $in: HOLDING_STATUSES },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
  };
  if (excludeId) query._id = { $ne: excludeId };
  if (suiteId) query.suite = suiteId;
  const overlapping = await Booking.find(query).select('suite checkIn checkOut name ref status');

  const bySuite = new Map();
  for (const b of overlapping) {
    if (!bySuite.has(b.suite)) bySuite.set(b.suite, []);
    bySuite.get(b.suite).push(b);
  }
  const result = new Map();
  for (const [suite, list] of bySuite) {
    let peak = 0;
    for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
      peak = Math.max(peak, list.filter((b) => b.checkIn <= d && d < b.checkOut).length);
    }
    result.set(suite, { booked: peak, bookings: list });
  }
  return result;
}

/** Every suite with how many rooms are free for the whole stay. */
async function availability(checkIn, checkOut, { excludeId, includeHidden = false } = {}) {
  if (!isDay(checkIn) || !isDay(checkOut) || checkOut <= checkIn) throw ApiError.badRequest('Choose valid check-in and check-out dates');
  const [suites, taken] = await Promise.all([
    Suite.find(includeHidden ? {} : { active: true }).sort({ order: 1 }),
    occupancy(checkIn, checkOut, { excludeId }),
  ]);
  return suites.map((s) => {
    const inventory = s.inventory || 1;
    const booked = taken.get(s._id)?.booked || 0;
    return { id: s._id, name: s.name, inventory, booked, free: Math.max(inventory - booked, 0), available: booked < inventory };
  });
}

/** Refuses a stay that would need more rooms than the suite has. */
async function assertAvailable(data, excludeId) {
  if (!HOLDING_STATUSES.includes(data.status)) return;
  const suite = await Suite.findById(data.suite).select('inventory name');
  const inventory = suite?.inventory || 1;
  const taken = (await occupancy(data.checkIn, data.checkOut, { excludeId, suiteId: data.suite })).get(data.suite);
  if (taken && taken.booked >= inventory) {
    const other = taken.bookings[0];
    throw ApiError.conflict(
      inventory > 1
        ? `All ${inventory} ${suite.name} rooms are already booked on some of these nights`
        : `The ${suite?.name || 'suite'} Suite is already booked for these dates (${other.name}, ${other.ref}, ${other.checkIn} → ${other.checkOut})`,
    );
  }
}

/**
 * Checks the suite and add-ons exist and works out the bill:
 *   base fee (nights × rate) + add-ons + convenience fee − discount, then GST on that.
 * Prices are snapshotted on the booking — `previous` keeps the agreed rate and
 * add-on prices unless the suite changes or the admin sends new ones.
 */
async function prepare(data, previous) {
  const suite = await Suite.findById(data.suite);
  if (!suite) throw ApiError.badRequest('Choose a suite that exists');

  const nights = nightsBetween(data.checkIn, data.checkOut);

  // Nightly rate: one the admin typed wins; moving to another suite takes that suite's
  // price; otherwise the rate already agreed for this booking stays.
  // 0 / empty means "not given" — older bookings carry a default rate of 0
  const sentRate = Number(data.rate) > 0;
  const typedNewRate = sentRate && (!previous || Number(data.rate) !== previous.rate);
  let rate;
  if (typedNewRate) rate = Number(data.rate);
  else if (!previous || previous.suite !== data.suite) rate = suite.price;
  else rate = previous.rate ?? suite.price;
  rate = money(rate);

  // Add-ons: keep the price already agreed for each, or the one the admin typed, else the catalogue price
  const ids = Array.isArray(data.addons) ? [...new Set(data.addons.map(String))] : [];
  const catalogue = ids.length ? await Addon.find({ _id: { $in: ids } }) : [];
  const given = new Map((data.addonItems || []).map((a) => [a.id, a]));
  const kept = new Map((previous?.addonItems || []).map((a) => [a.id, a]));
  const pricing = (await Setting.get()).invoice || {};
  const addonItems = catalogue.map((a) => {
    const g = given.get(a._id);
    const k = kept.get(a._id);
    const price = g && g.price !== undefined ? g.price : k ? k.price : a.price;
    // GST on an add-on: kept as agreed on this booking (older bookings taxed add-ons at the stay rate),
    // else the add-on's own rate, else the add-on default from Settings
    const taxRate = k ? k.taxRate ?? previous.taxRate ?? 0 : a.taxRate ?? pricing.addonTaxRate ?? 0;
    return { id: a._id, title: a.title, price: price === '' || price === null || price === undefined ? null : money(price), taxRate };
  });
  const roomTotal = money(nights * rate);
  const addonTotal = money(addonItems.reduce((t, a) => t + (a.price || 0), 0));

  // A value the admin typed (different from what the booking had) wins; otherwise it is
  // worked out again when the suite or dates change, and kept as agreed when they don't
  const typed = (k) => data[k] !== undefined && data[k] !== '' && data[k] !== null && (!previous || Number(data[k]) !== previous[k]);
  const stayChanged = !previous || previous.suite !== data.suite || previous.checkIn !== data.checkIn || previous.checkOut !== data.checkOut;

  // GST: the suite's own rate, else the default from Settings
  let taxRate;
  if (typed('taxRate')) taxRate = Number(data.taxRate) || 0;
  else if (stayChanged) taxRate = suite.taxRate ?? pricing.taxRate ?? 0;
  else taxRate = previous.taxRate ?? 0;

  // Convenience fee: fixed ₹ per booking, or a % of the base fee
  let convenienceFee;
  if (typed('convenienceFee')) convenienceFee = Number(data.convenienceFee) || 0;
  else if (stayChanged || previous.rate !== rate) {
    convenienceFee = pricing.convenienceFeeType === 'percent' ? (roomTotal * (pricing.convenienceFee || 0)) / 100 : pricing.convenienceFee || 0;
  } else convenienceFee = previous.convenienceFee ?? 0;
  convenienceFee = money(convenienceFee);

  const discount = money(data.discount);
  // GST on the stay (base fee + convenience fee − discount) at the suite's rate,
  // and on each add-on at its own rate
  const stayTaxable = Math.max(roomTotal + convenienceFee - discount, 0);
  const stayTaxAmount = money((stayTaxable * taxRate) / 100);
  const addonTaxAmount = money(addonItems.reduce((t, a) => t + ((a.price || 0) * (a.taxRate || 0)) / 100, 0));
  const taxAmount = money(stayTaxAmount + addonTaxAmount);

  return {
    ...data,
    suiteName: suite.name,
    rate,
    nights,
    addons: addonItems.map((a) => a.id),
    addonItems,
    roomTotal,
    addonTotal,
    convenienceFee,
    discount,
    taxRate,
    addonTaxAmount,
    taxAmount,
    total: money(stayTaxable + addonTotal + taxAmount),
    amountPaid: money(data.amountPaid),
  };
}

/** Records when a booking was confirmed, checked in, checked out or cancelled. */
function stampStatus(data, previousStatus) {
  if (data.status === previousStatus) return data;
  const now = new Date();
  const out = { ...data };
  if (data.status === 'confirmed' && !data.confirmedAt) out.confirmedAt = now;
  if (data.status === 'checked-in') {
    out.confirmedAt = data.confirmedAt || now;
    out.checkedInAt = data.checkedInAt || now;
  }
  if (data.status === 'completed') out.checkedOutAt = data.checkedOutAt || now;
  if (data.status === 'cancelled') out.cancelledAt = now;
  return out;
}

module.exports = { prepare, assertAvailable, availability, occupancy, stampStatus, nightsBetween, isDay };
