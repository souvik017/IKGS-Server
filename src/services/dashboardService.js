const Enquiry = require('../models/Enquiry');
const Booking = require('../models/Booking');
const Appointment = require('../models/Appointment');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const InventoryItem = require('../models/InventoryItem');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Aggregate dashboard metrics straight from the database (never mocked).
 */
async function getSummary() {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    totalEnquiries,
    newEnquiries,
    pendingBookings,
    todaysAppointments,
    upcomingAppointments,
    totalCustomers,
    pendingQuotations,
    unpaidInvoices,
    outstandingAgg,
    inventoryItems,
  ] = await Promise.all([
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: 'new' }),
    Booking.countDocuments({ status: { $in: ['new', 'pending'] } }),
    Appointment.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $nin: ['cancelled', 'completed'] },
    }),
    Appointment.countDocuments({
      date: { $gt: todayEnd },
      status: { $nin: ['cancelled', 'completed'] },
    }),
    Customer.countDocuments(),
    Quotation.countDocuments({ status: { $in: ['draft', 'sent'] } }),
    Invoice.countDocuments({ paymentStatus: { $in: ['unpaid', 'partially-paid'] } }),
    Invoice.aggregate([
      { $match: { paymentStatus: { $in: ['unpaid', 'partially-paid'] } } },
      { $group: { _id: null, amount: { $sum: '$balanceDue' } } },
    ]),
    InventoryItem.find({ active: true }, 'quantity lowStockThreshold'),
  ]);

  const lowStock = inventoryItems.filter(
    (i) => Number(i.quantity) <= Number(i.lowStockThreshold)
  ).length;

  const outstandingAmount = outstandingAgg[0]?.amount || 0;

  return {
    totalEnquiries,
    newEnquiries,
    pendingBookings,
    todaysAppointments,
    upcomingAppointments,
    totalCustomers,
    pendingQuotations,
    unpaidInvoices,
    outstandingAmount,
    lowStockItems: lowStock,
  };
}

module.exports = { getSummary };
