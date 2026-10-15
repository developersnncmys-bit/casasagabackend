module.exports = {
  BOOKING_STATUSES: ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'],
  BOOKING_SOURCES: ['website', 'whatsapp', 'phone', 'walk-in', 'other'],
  ENQUIRY_STATUSES: ['new', 'replied', 'closed'],
  PAYMENT_MODES: ['', 'cash', 'upi', 'card', 'bank-transfer', 'other'],
  // Bookings that count towards revenue
  EARNING_STATUSES: ['confirmed', 'checked-in', 'completed'],
  // Bookings that take up a room — a suite is unavailable once these fill its inventory
  HOLDING_STATUSES: ['pending', 'confirmed', 'checked-in'],
};
