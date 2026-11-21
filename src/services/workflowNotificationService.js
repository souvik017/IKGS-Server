const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const Appointment = require('../models/Appointment');
const { sendSystemMail } = require('./mailService');
const { publishAdminNotification } = require('./adminNotificationService');

const safe = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dateText = (value) => value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'To be confirmed';

async function notifyAppointmentAssigned(appointmentId) {
  const appointment = await Appointment.findById(appointmentId)
    .populate('employee', 'name email')
    .populate('customer', 'name phone')
    .populate('service', 'title');
  if (!appointment?.employee?.email) return;
  const employee = appointment.employee;
  const subject = `Appointment assigned: ${appointment.appointmentId}`;
  const text = [
    `Hello ${employee.name},`, '', `A service appointment has been assigned to you.`,
    `Reference: ${appointment.appointmentId}`, `Date: ${dateText(appointment.date)}`,
    `Time: ${appointment.time || 'To be confirmed'}`, `Customer: ${appointment.customer?.name || 'Customer'}`,
    `Phone: ${appointment.customer?.phone || 'Not provided'}`, `Service: ${appointment.service?.title || 'Service'}`,
    `Location: ${appointment.address || 'See your employee portal'}`, '', 'Please sign in to your employee portal for the full details.',
  ].join('\n');
  await sendSystemMail({ to: employee.email, subject, text, html: `<p>Hello ${safe(employee.name)},</p><p>A service appointment has been assigned to you.</p><ul><li><b>Reference:</b> ${safe(appointment.appointmentId)}</li><li><b>Date:</b> ${safe(dateText(appointment.date))}</li><li><b>Time:</b> ${safe(appointment.time || 'To be confirmed')}</li><li><b>Customer:</b> ${safe(appointment.customer?.name)}</li><li><b>Service:</b> ${safe(appointment.service?.title)}</li><li><b>Location:</b> ${safe(appointment.address)}</li></ul><p>Please sign in to your employee portal for the full details.</p>` });
}

async function notifyAdminsOfClosure(closureId) {
  const closure = await require('../models/AppointmentClosure').findById(closureId);
  if (!closure) return;
  const appointment = await Appointment.findById(closure.appointment)
    .populate('employee', 'name email').populate('customer', 'name phone').populate('service', 'title');
  if (!appointment) return;
  const recipients = await Admin.find({ active: true }).select('email');
  const to = [...new Set(recipients.map((admin) => admin.email).filter(Boolean))].join(',');
  const subject = `Closure review required: ${appointment.appointmentId}`;
  publishAdminNotification({
    type: 'closure-request', title: 'Appointment closure needs review',
    message: `${appointment.appointmentId} · ${appointment.employee?.name || 'Employee'}`,
    appointmentId: String(appointment._id), closureId: String(closure._id),
  });
  const text = [
    'An employee submitted an appointment closure request for review.',
    `Appointment: ${appointment.appointmentId}`, `Employee: ${appointment.employee?.name || 'Employee'}`,
    `Customer: ${appointment.customer?.name || 'Customer'}`, `Service: ${appointment.service?.title || 'Service'}`,
    `Submitted: ${dateText(closure.completedAt)}`, `Photos: ${closure.images.length}`,
    'Open the IKGS admin panel and review Closure requests.',
  ].join('\n');
  await sendSystemMail({ to, subject, text, html: `<p>An employee submitted an appointment closure request for review.</p><ul><li><b>Appointment:</b> ${safe(appointment.appointmentId)}</li><li><b>Employee:</b> ${safe(appointment.employee?.name)}</li><li><b>Customer:</b> ${safe(appointment.customer?.name)}</li><li><b>Service:</b> ${safe(appointment.service?.title)}</li><li><b>Submitted:</b> ${safe(dateText(closure.completedAt))}</li><li><b>Photos:</b> ${closure.images.length}</li></ul><p>Open the IKGS admin panel and review Closure requests.</p>` });
}

module.exports = { notifyAppointmentAssigned, notifyAdminsOfClosure };
