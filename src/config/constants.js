module.exports = {
  BOOKING_STATUSES: ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'],
  // Where a booking came from
  BOOKING_SOURCES: ['website', 'instagram', 'facebook', 'google', 'whatsapp', 'phone', 'walk-in', 'referral', 'other'],
  // Sources the website may report (the guest arrived from one of these); anything else is "website"
  WEBSITE_SOURCES: ['website', 'instagram', 'facebook', 'google', 'whatsapp', 'referral'],
  PAYMENT_MODES: ['', 'cash', 'upi', 'card', 'bank-transfer', 'other'],
  // Bookings that count towards revenue
  EARNING_STATUSES: ['confirmed', 'checked-in', 'completed'],
  // Bookings that take up a room — a suite is unavailable once these fill its inventory
  HOLDING_STATUSES: ['pending', 'confirmed', 'checked-in'],
};
