const Appointment = require('../models/Appointment');
const AppointmentClosure = require('../models/AppointmentClosure');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const Employee = require('../models/Employee');
const InventoryItem = require('../models/InventoryItem');
const InventoryTransaction = require('../models/InventoryTransaction');
const { applyMovement } = require('../services/inventoryService');
const Service = require('../models/Service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { appointmentId: newAppointmentId } = require('../utils/ids');
const { notifyAppointmentAssigned } = require('../services/workflowNotificationService');

const STATUSES = [
  'scheduled',
  'confirmed',
  'assigned',
  'in-progress',
  'completed',
  'cancelled',
  'rescheduled',
];

const POPULATE = [
  { path: 'customer', select: 'name phone email address' },
  { path: 'service', select: 'title slug shortDescription description' },
  { path: 'employee', select: 'name employeeId phone' },
  { path: 'booking', select: 'bookingId status name phone email' },
  { path: 'materials.item', select: 'itemName sku unit' },
];

// @desc    List appointments
// @route   GET /api/appointments
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { date: 1, time: 1 });
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.employee) query.employee = req.query.employee;
  if (req.query.customer) query.customer = req.query.customer;
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) query.date.$gte = new Date(req.query.from);
    if (req.query.to) query.date.$lte = new Date(req.query.to);
  }
  if (req.query.today === 'true') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    query.date = { $gte: start, $lte: end };
  }
  Object.assign(query, buildSearch(req.query.search, ['appointmentId', 'address']));

  const [appointments, total] = await Promise.all([
    Appointment.find(query).populate(POPULATE).sort({ date: 1, time: 1 }).skip(skip).limit(limit),
    Appointment.countDocuments(query),
  ]);
  return sendList(res, appointments, { page, limit, total });
});

// @desc    Get an appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate(POPULATE);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  const [closure, materialHistory] = await Promise.all([
    AppointmentClosure.findOne({ appointment: appointment._id }),
    InventoryTransaction.find({ appointment: appointment._id }).populate('item', 'itemName sku unit').populate('performedBy', 'name').sort({ createdAt: -1 }),
  ]);
  return sendSuccess(res, { appointment, closure, materialHistory });
});

exports.assignMaterial = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate('customer', 'name');
  if (!appointment) throw ApiError.notFound('Appointment not found');
  const { itemId, quantity, notes } = req.body;
  const item = await InventoryItem.findById(itemId);
  if (!item || !item.active) throw ApiError.badRequest('Select an active inventory item');
  const result = await applyMovement({ itemId, type: 'stock-out', quantity, reference: appointment.appointmentId, notes: notes || `Assigned for ${appointment.appointmentId}`, performedBy: req.admin?._id, appointment: appointment._id, appointmentId: appointment.appointmentId, customerName: appointment.customer?.name });
  const existing = appointment.materials.find((m) => String(m.item) === String(item._id));
  if (existing) existing.quantity += Number(quantity);
  else appointment.materials.push({ item: item._id, itemName: item.itemName, quantity: Number(quantity), unit: item.unit, assignedBy: req.admin?._id });
  await appointment.save();
  return sendSuccess(res, { appointment, item: result.item, transaction: result.transaction }, 201);
});

// @desc    Create an appointment
// @route   POST /api/appointments
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { customer, booking, service, date, time, address, employee, jobNotes } = req.body;
  if (!customer || !date) throw ApiError.badRequest('Customer and date are required');

  const customerDoc = await Customer.findById(customer);
  if (!customerDoc) throw ApiError.badRequest('Customer not found');
  if (booking) {
    const bookingDoc = await Booking.findById(booking);
    if (!bookingDoc) throw ApiError.badRequest('Booking not found');
  }
  if (service) {
    const serviceDoc = await Service.findById(service);
    if (!serviceDoc) throw ApiError.badRequest('Service not found');
  }
  if (employee) {
    const emp = await Employee.findById(employee);
    if (!emp || !emp.active) throw ApiError.badRequest('Selected employee is unavailable');
  }

  const appointment = await Appointment.create({
    appointmentId: newAppointmentId(),
    customer,
    booking: booking || undefined,
    service: service || undefined,
    date: new Date(date),
    time,
    address,
    employee: employee || undefined,
    jobNotes,
    status: employee ? 'assigned' : 'scheduled',
    createdBy: req.admin?._id,
  });

  if (booking) await Booking.findByIdAndUpdate(booking, { status: 'confirmed' });
  if (employee) notifyAppointmentAssigned(appointment._id).catch((error) => console.error('[mail] Assignment notice failed:', error.message));

  return sendSuccess(res, { appointment }, 201);
});

// @desc    Update an appointment
// @route   PUT /api/appointments/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const previous = req.body.employee !== undefined ? await Appointment.findById(req.params.id).select('employee') : null;
  const allowed = ['service', 'date', 'time', 'address', 'employee', 'jobNotes', 'status'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (updates.date) updates.date = new Date(updates.date);
  if (updates.status && !STATUSES.includes(updates.status)) {
    throw ApiError.badRequest(`Invalid status. Allowed: ${STATUSES.join(', ')}`);
  }
  if (updates.status === 'completed') throw ApiError.badRequest('Appointments can only be completed after an admin approves the closure request');

  const appointment = await Appointment.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate(POPULATE);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (req.body.employee && String(req.body.employee) !== String(previous?.employee || '')) {
    notifyAppointmentAssigned(appointment._id).catch((error) => console.error('[mail] Assignment notice failed:', error.message));
  }
  return sendSuccess(res, { appointment });
});

// @desc    Update appointment status
// @route   PUT /api/appointments/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw ApiError.badRequest(`Invalid status. Allowed: ${STATUSES.join(', ')}`);
  if (status === 'completed') throw ApiError.badRequest('Appointments can only be completed after an admin approves the closure request');

  const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate(
    POPULATE
  );
  if (!appointment) throw ApiError.notFound('Appointment not found');

  if (status === 'completed' && appointment.booking) {
    await Booking.findByIdAndUpdate(appointment.booking, { status: 'completed' });
  }
  return sendSuccess(res, { appointment });
});

// @desc    Assign an employee
// @route   PUT /api/appointments/:id/assign
// @access  Private
exports.assign = asyncHandler(async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) throw ApiError.badRequest('Employee id is required');

  const previous = await Appointment.findById(req.params.id).select('employee');
  if (!previous) throw ApiError.notFound('Appointment not found');

  const employee = await Employee.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (!employee.active) throw ApiError.badRequest('Employee is inactive');

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    { employee: employeeId, status: 'assigned' },
    { new: true }
  ).populate(POPULATE);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (String(previous.employee || '') !== String(employeeId)) {
    notifyAppointmentAssigned(appointment._id).catch((error) => console.error('[mail] Assignment notice failed:', error.message));
  }
  return sendSuccess(res, { appointment });
});

// @desc    Delete an appointment
// @route   DELETE /api/appointments/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const closure = await AppointmentClosure.findOne({ appointment: req.params.id });
  if (closure) throw ApiError.conflict('Cannot delete an appointment that has a closure record');
  const appointment = await Appointment.findByIdAndDelete(req.params.id);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  return sendSuccess(res, { message: 'Appointment deleted' });
});
