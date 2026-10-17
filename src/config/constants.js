module.exports = {
  BOOKING_STATUSES: ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'],
  // Where a booking came from
  BOOKING_SOURCES: ['website', 'instagram', 'facebook', 'google', 'whatsapp', 'phone', 'walk-in', 'referral', 'other'],
  // Sources the website may report (the guest arrived from one of these); anything else is "website"
  WEBSITE_SOURCES: ['website', 'instagram', 'facebook', 'google', 'whatsapp', 'referral'],
  PAYMENT_MODES: ['', 'cash', 'upi', 'card', 'bank-transfer', 'razorpay', 'other'],
  // Online payment on the website: '' = not paid online (or paid at the property)
  PAYMENT_STATUSES: ['', 'awaiting', 'paid'],
  // How long a website booking holds its room while the guest pays
  PAYMENT_HOLD_MINUTES: 15,
  // TEMPORARY, for testing live payments: bookings made with these emails are charged ₹1
  // instead of the full amount. Empty the list to switch the test off.
  PAYMENT_TEST_EMAILS: ['casasaga.in@gmail.com', 'dhanalakshmisb294@gmail.com'],
  // Bookings that count towards revenue
  EARNING_STATUSES: ['confirmed', 'checked-in', 'completed'],
  // Bookings that take up a room — a suite is unavailable once these fill its inventory
  HOLDING_STATUSES: ['pending', 'confirmed', 'checked-in'],
};
