const Enquiry = require('../models/Enquiry');
const Booking = require('../models/Booking');
const Appointment = require('../models/Appointment');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const InventoryItem = require('../models/InventoryItem');
const Employee = require('../models/Employee');

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
  const monthStart = new Date(todayEnd.getFullYear(), todayEnd.getMonth(), 1);

  const [
    totalEnquiries,
    newEnquiries,
    pendingBookings,
    pendingFreeInspections,
    todaysAppointments,
    upcomingAppointments,
    totalCustomers,
    pendingQuotations,
    unpaidInvoices,
    outstandingAgg,
    revenueAgg,
    monthRevenueAgg,
    inventoryItems,
    employees,
  ] = await Promise.all([
    Enquiry.countDocuments(),
    Enquiry.countDocuments({ status: 'new' }),
    Booking.countDocuments({ status: { $in: ['new', 'pending'] } }),
    Booking.countDocuments({ source: 'website', status: { $in: ['new', 'pending'] } }),
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
    Invoice.aggregate([{ $group: { _id: null, amount: { $sum: '$amountPaid' } } }]),
    Invoice.aggregate([{ $match: { createdAt: { $gte: monthStart } } }, { $group: { _id: null, amount: { $sum: '$amountPaid' } } }]),
    InventoryItem.find({ active: true }, 'quantity lowStockThreshold'),
    Employee.find({ active: true, dateOfBirth: { $ne: null } }, 'name dateOfBirth'),
  ]);

  const lowStock = inventoryItems.filter(
    (i) => Number(i.quantity) <= Number(i.lowStockThreshold)
  ).length;

  const outstandingAmount = outstandingAgg[0]?.amount || 0;
  const revenueAllTime = revenueAgg[0]?.amount || 0;
  const revenueThisMonth = monthRevenueAgg[0]?.amount || 0;
  const today = new Date();
  const birthdayEmployees = employees.filter((e) => e.dateOfBirth && new Date(e.dateOfBirth).getUTCMonth() === today.getUTCMonth() && new Date(e.dateOfBirth).getUTCDate() === today.getUTCDate()).map((e) => ({ id: e._id, name: e.name }));

  return {
    totalEnquiries,
    newEnquiries,
    pendingBookings,
    pendingFreeInspections,
    todaysAppointments,
    upcomingAppointments,
    totalCustomers,
    pendingQuotations,
    unpaidInvoices,
    outstandingAmount,
    revenueAllTime,
    revenueThisMonth,
    lowStockItems: lowStock,
    birthdayEmployees,
  };
}

module.exports = { getSummary };
