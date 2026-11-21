const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');
const Appointment = require('../models/Appointment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { buildSearch } = require('../utils/query');
const { employeeId: newEmployeeId } = require('../utils/ids');
const { encryptAadhaar, aadhaarLast4 } = require('../utils/pii');

function safeEmployee(employee) {
  const data = employee.toObject();
  delete data.passwordHash;
  const encrypted = employee.aadhaarEncrypted || data.aadhaarEncrypted;
  delete data.aadhaarEncrypted;
  data.aadhaarLast4 = aadhaarLast4(encrypted);
  return data;
}

// @desc    List employees
// @route   GET /api/employees
// @access  Private
exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const query = {};
  if (req.query.active !== undefined && req.query.active !== 'all') {
    query.active = req.query.active === 'true';
  }
  Object.assign(query, buildSearch(req.query.search, ['name', 'email', 'employeeId', 'phone']));

  const [employees, total] = await Promise.all([
    Employee.find(query).select('+aadhaarEncrypted').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Employee.countDocuments(query),
  ]);
  return sendList(res, employees.map(safeEmployee), { page, limit, total });
});

// @desc    Get an employee with assigned appointment count
// @route   GET /api/employees/:id
// @access  Private
exports.getById = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id).select('+aadhaarEncrypted');
  if (!employee) throw ApiError.notFound('Employee not found');
  const assignedAppointments = await Appointment.countDocuments({ employee: employee._id });
  return sendSuccess(res, { employee: safeEmployee(employee), assignedAppointments });
});

// @desc    Create an employee
// @route   POST /api/employees
// @access  Private
exports.create = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (!name) throw ApiError.badRequest('Employee name is required');
  if (email) {
    const exists = await Employee.findOne({ email: String(email).toLowerCase() });
    if (exists) throw ApiError.conflict('An employee with this email already exists');
  }

  if (!email) throw ApiError.badRequest('An email address is required for employee login');
  if (!req.body.password || String(req.body.password).length < 8) throw ApiError.badRequest('Employee login password must be at least 8 characters');
  const employee = await Employee.create({
    employeeId: req.body.employeeId || newEmployeeId(),
    name,
    phone: req.body.phone,
    email: email ? String(email).toLowerCase() : undefined,
    designation: req.body.designation,
    dateOfBirth: req.body.dateOfBirth || undefined,
    address: req.body.address,
    aadhaarEncrypted: req.body.aadhaar ? encryptAadhaar(req.body.aadhaar) : undefined,
    profileImage: req.body.profileImage,
    joiningDate: req.body.joiningDate,
    active: req.body.active,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    notes: req.body.notes,
  });
  return sendSuccess(res, { employee: safeEmployee(await Employee.findById(employee._id).select('+aadhaarEncrypted')) }, 201);
});

// @desc    Update an employee
// @route   PUT /api/employees/:id
// @access  Private
exports.update = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'email', 'designation', 'profileImage', 'joiningDate', 'active', 'notes', 'dateOfBirth', 'address'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  if (updates.email) updates.email = String(updates.email).toLowerCase();
  if (req.body.password) {
    if (String(req.body.password).length < 8) throw ApiError.badRequest('Password must be at least 8 characters');
    updates.passwordHash = await bcrypt.hash(req.body.password, 12);
  }
  if (req.body.aadhaar) updates.aadhaarEncrypted = encryptAadhaar(req.body.aadhaar);

  const employee = await Employee.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).select('+aadhaarEncrypted');
  if (!employee) throw ApiError.notFound('Employee not found');
  return sendSuccess(res, { employee: safeEmployee(employee) });
});

// @desc    Activate/deactivate an employee
// @route   PUT /api/employees/:id/status
// @access  Private
exports.setStatus = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(
    req.params.id,
    { active: Boolean(req.body.active) },
    { new: true }
  );
  if (!employee) throw ApiError.notFound('Employee not found');
  return sendSuccess(res, { employee });
});

// @desc    Delete an employee
// @route   DELETE /api/employees/:id
// @access  Private
exports.remove = asyncHandler(async (req, res) => {
  const activeAssignments = await Appointment.countDocuments({
    employee: req.params.id,
    status: { $nin: ['completed', 'cancelled'] },
  });
  if (activeAssignments > 0) {
    throw ApiError.conflict('Employee has active appointments and cannot be deleted');
  }
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  return sendSuccess(res, { message: 'Employee deleted' });
});
