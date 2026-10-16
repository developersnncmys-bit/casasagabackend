const { Booking, Enquiry, Suite, Addon, GalleryImage, Story } = require('../models');
const catchAsync = require('../helpers/catchAsync');
const { EARNING_STATUSES } = require('../config/constants');
const { nightsBetween } = require('../services/booking.service');

const day = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Headline numbers for the dashboard. */
exports.summary = catchAsync(async (req, res) => {
  const now = new Date();
  const today = day(now);
  const month = today.slice(0, 7);
  const in7 = day(new Date(now.getTime() + 7 * 86400000));

  const [monthStays, pending, newEnquiries, upcoming, inHouse, counts, bySource] = await Promise.all([
    Booking.find({ status: { $in: EARNING_STATUSES }, checkIn: { $regex: `^${month}` } }).select('total checkIn checkOut'),
    Booking.countDocuments({ status: 'pending' }),
    Enquiry.countDocuments({ status: 'new' }),
    Booking.find({ status: { $in: ['pending', 'confirmed'] }, checkIn: { $gte: today, $lte: in7 } }).sort({ checkIn: 1 }),
    Booking.find({ status: 'checked-in' }).sort({ checkOut: 1 }),
    Promise.all([Suite.countDocuments(), Addon.countDocuments(), GalleryImage.countDocuments(), Story.countDocuments()]),
    Booking.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$source', count: { $sum: 1 }, revenue: { $sum: '$total' } } }, { $sort: { count: -1 } }]),
  ]);

  res.json({
    success: true,
    data: {
      pendingBookings: pending,
      newEnquiries,
      revenueThisMonth: monthStays.reduce((t, b) => t + (b.total || 0), 0),
      nightsThisMonth: monthStays.reduce((t, b) => t + nightsBetween(b.checkIn, b.checkOut), 0),
      upcoming,
      inHouse,
      counts: { suites: counts[0], addons: counts[1], gallery: counts[2], stories: counts[3] },
      bySource: bySource.map((s) => ({ source: s._id || 'website', count: s.count, revenue: s.revenue })),
    },
  });
});
