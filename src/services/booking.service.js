const Suite = require('../models/Suite');
const Addon = require('../models/Addon');
const Booking = require('../models/Booking');
const Setting = require('../models/Setting');
const Block = require('../models/Block');
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
    // A website booking still waiting for payment holds its room only until its hold runs out
    // (once the team confirms it by hand, it holds the room like any other)
    $or: [{ status: { $ne: 'pending' } }, { paymentStatus: { $ne: 'awaiting' } }, { holdUntil: { $gt: new Date() } }],
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

/** Blocked dates touching any night of [checkIn, checkOut) — blocks cover `from`…`to` inclusive. */
const blocksDuring = (checkIn, checkOut) => Block.find({ from: { $lt: checkOut }, to: { $gte: checkIn } });

/**
 * Rooms of a suite taken on the busiest night of [checkIn, checkOut): its bookings that night plus
 * the rooms blocked that night (a block closes `rooms` rooms, or all of them). Also says whether
 * blocks were what filled it.
 */
function busiestNight(suite, checkIn, checkOut, bookings = [], blocks = []) {
  const inventory = suite.inventory || 1;
  const mine = blocks.filter((b) => b.covers(suite));
  let peak = 0;
  let blockedPeak = 0;
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    const booked = bookings.filter((b) => b.checkIn <= d && d < b.checkOut).length;
    const blocked = Math.min(inventory, mine.filter((b) => b.from <= d && d <= b.to).reduce((n, b) => n + (b.rooms || inventory), 0));
    if (booked + blocked > peak) peak = booked + blocked;
    blockedPeak = Math.max(blockedPeak, blocked);
  }
  return { taken: Math.min(peak, inventory), blocked: blockedPeak, blocks: mine };
}

/** Every suite with how many rooms are free for the whole stay. */

async function availability(checkIn, checkOut, { excludeId, includeHidden = false } = {}) {
  if (!isDay(checkIn) || !isDay(checkOut) || checkOut <= checkIn) throw ApiError.badRequest('Choose valid check-in and check-out dates');
  const [suites, taken, blocks] = await Promise.all([
    Suite.find(includeHidden ? {} : { active: true }).sort({ order: 1 }),
    occupancy(checkIn, checkOut, { excludeId }),
    blocksDuring(checkIn, checkOut),
  ]);
  return suites.map((s) => {
    const inventory = s.inventory || 1;
    // Bookings and blocked rooms together, on the busiest night of the stay
    const night = busiestNight(s, checkIn, checkOut, taken.get(s._id)?.bookings, blocks);
    return { id: s._id, name: s.name, inventory, booked: night.taken, free: Math.max(inventory - night.taken, 0), available: night.taken < inventory, blocked: night.blocked };
  });
}

/** Refuses a stay that would need more rooms than the suite has. */
async function assertAvailable(data, excludeId) {
  if (!HOLDING_STATUSES.includes(data.status)) return;
  const suite = await Suite.findById(data.suite).select('inventory name location');
  const inventory = suite?.inventory || 1;
  const taken = (await occupancy(data.checkIn, data.checkOut, { excludeId, suiteId: data.suite })).get(data.suite);
  // Blocked dates (Calendar → Block dates) close some or all rooms
  const night = suite && busiestNight(suite, data.checkIn, data.checkOut, taken?.bookings, await blocksDuring(data.checkIn, data.checkOut));
  if (night && night.taken >= inventory && night.blocked > 0) {
    const block = night.blocks[0];
    const when = block.from === block.to ? block.from : `${block.from} → ${block.to}`;
    throw ApiError.conflict(
      `${suite.name} is ${night.blocked < inventory ? 'fully booked or blocked' : 'blocked'} on ${when}${block.reason ? ` (${block.reason})` : ''} — choose other dates`,
    );
  }
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
 * The suite's offer for a stay: { amount, note } — % off or ₹ off per night on the base fee,
 * while the offer runs (discountUntil = last check-in date it covers). Same sums as the website.
 */
function suiteOffer(suite, nights, rate, checkIn) {
  const value = Number(suite.discountValue) || 0;
  if (!value || !nights || (suite.discountUntil && checkIn > suite.discountUntil)) return { amount: 0, note: '' };
  const base = nights * rate;
  const amount = money(Math.min(base, suite.discountType === 'flat' ? value * nights : (base * Math.min(value, 100)) / 100));
  const what = suite.discountType === 'flat' ? `₹${value.toLocaleString('en-IN')} off per night` : `${value}% off`;
  return { amount, note: suite.discountLabel ? `${suite.discountLabel} · ${what}` : what };
}

/**
 * Checks the suite and add-ons exist and works out the bill:
 *   base fee (nights × rate) + extra guests (nights × guests over what the price covers × charge) − discount
 *   + add-ons, GST on each, then the convenience fee (online bookings, after GST).
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

  // Guests: the suite's price covers includedGuests; each guest beyond that pays the extra-guest
  // charge every night, up to the suite's maximum
  const guests = Math.max(Math.round(Number(data.guests) || 2), 1);
  const maxGuests = suite.maxGuests || 10;
  const guestsChanged = !previous || previous.guests !== guests || previous.suite !== data.suite;
  if (guests > maxGuests && guestsChanged) throw ApiError.badRequest(`The ${suite.name} Suite takes up to ${maxGuests} guests`);
  const extraGuests = Math.max(guests - (suite.includedGuests || 2), 0);
  // The charge agreed when the extra guest was first added stays; otherwise the suite's current one
  const extraGuestRate = money(
    previous && previous.suite === data.suite && previous.extraGuests > 0 ? previous.extraGuestRate : suite.extraGuestPrice || 0,
  );
  const extraGuestTotal = money(nights * extraGuests * extraGuestRate);

  // A value the admin typed (different from what the booking had) wins; otherwise it is
  // worked out again when the suite or dates change, and kept as agreed when they don't
  const typed = (k) => data[k] !== undefined && data[k] !== '' && data[k] !== null && (!previous || Number(data[k]) !== previous[k]);
  const stayChanged = !previous || previous.suite !== data.suite || previous.checkIn !== data.checkIn || previous.checkOut !== data.checkOut;

  // GST: the suite's own rate, else the default from Settings
  let taxRate;
  if (typed('taxRate')) taxRate = Number(data.taxRate) || 0;
  else if (stayChanged) taxRate = suite.taxRate ?? pricing.taxRate ?? 0;
  else taxRate = previous.taxRate ?? 0;

  // Discount: website bookings get the suite's offer (worked out again when the stay changes);
  // otherwise the amount the admin typed, as agreed
  let discount = money(data.discount);
  let discountNote = data.discountNote ?? previous?.discountNote ?? '';
  if ((data.online ?? previous?.online) && stayChanged && !typed('discount')) {
    const offer = suiteOffer(suite, nights, rate, data.checkIn);
    discount = offer.amount;
    discountNote = offer.note;
  }
  // GST on the stay (base fee + extra guests − discount) at the suite's rate, and on each add-on at its own rate
  const stayTaxable = Math.max(roomTotal + extraGuestTotal - discount, 0);
  const stayTaxAmount = money((stayTaxable * taxRate) / 100);
  const addonTaxAmount = money(addonItems.reduce((t, a) => t + ((a.price || 0) * (a.taxRate || 0)) / 100, 0));
  const taxAmount = money(stayTaxAmount + addonTaxAmount);
  const subtotal = stayTaxable + addonTotal + taxAmount;

  // Convenience fee: online (website) bookings only, added last — a % of the total
  // after GST, or a fixed ₹ amount. Not taxed. Bookings made in the admin panel have
  // none unless the admin types one.
  const online = data.online ?? previous?.online ?? false;
  let convenienceFee;
  if (typed('convenienceFee')) convenienceFee = Number(data.convenienceFee) || 0;
  else if (online) {
    convenienceFee = pricing.convenienceFeeType === 'percent' ? (subtotal * (pricing.convenienceFee || 0)) / 100 : pricing.convenienceFee || 0;
  } else convenienceFee = previous?.convenienceFee ?? 0;
  convenienceFee = money(convenienceFee);

  return {
    ...data,
    suiteName: suite.name,
    rate,
    nights,
    addons: addonItems.map((a) => a.id),
    addonItems,
    roomTotal,
    guests,
    extraGuests,
    extraGuestRate,
    extraGuestTotal,
    addonTotal,
    convenienceFee,
    discount,
    discountNote: discount > 0 ? discountNote : '',
    taxRate,
    addonTaxAmount,
    taxAmount,
    online,
    total: money(subtotal + convenienceFee),
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

module.exports = { suiteOffer, prepare, assertAvailable, availability, occupancy, stampStatus, nightsBetween, isDay };
