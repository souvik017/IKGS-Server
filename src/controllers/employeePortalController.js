const Appointment = require('../models/Appointment');
const Enquiry = require('../models/Enquiry');
const Service = require('../models/Service');
const { sendSuccess, sendList, parsePagination } = require('../utils/apiResponse');
const { enquiryId: newEnquiryId } = require('../utils/ids');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const AppointmentClosure = require('../models/AppointmentClosure');
const { uploadImages } = require('../services/storageService');
const { notifyAdminsOfClosure } = require('../services/workflowNotificationService');
exports.dashboard = asyncHandler(async (req,res) => {
  const [appointments, enquiries, upcomingCount, upcoming] = await Promise.all([
    Appointment.countDocuments({ employee: req.employee._id }),
    Enquiry.countDocuments({ createdByEmployee: req.employee._id }),
    Appointment.countDocuments({ employee: req.employee._id, date: { $gte: new Date() }, status: { $nin: ['completed','cancelled'] } }),
    Appointment.find({ employee: req.employee._id, date: { $gte: new Date() }, status: { $nin: ['completed','cancelled'] } }).populate('customer','name phone').populate('service','title').sort({date:1}).limit(8),
  ]);
  const dob=req.employee.dateOfBirth ? new Date(req.employee.dateOfBirth) : null;
  const today=new Date();
  const isBirthday=Boolean(dob && dob.getUTCMonth()===today.getUTCMonth() && dob.getUTCDate()===today.getUTCDate());
  return sendSuccess(res,{ summary:{ appointments, enquiries, upcomingCount, upcoming, isBirthday, birthdayMessage:isBirthday?`Happy birthday, ${req.employee.name}! 🎉`:null } });
});
exports.appointments = asyncHandler(async (req,res) => {
  const {page,limit,skip}=parsePagination(req.query,{date:1});
  const query={employee:req.employee._id};
  const [rows,total]=await Promise.all([Appointment.find(query).populate('customer','name phone email').populate('service','title').populate('booking','bookingId name phone').sort({date:1}).skip(skip).limit(limit),Appointment.countDocuments(query)]);
  return sendList(res,rows,{page,limit,total});
});
exports.enquiries = asyncHandler(async (req,res) => {
  const {page,limit,skip}=parsePagination(req.query);
  const query={createdByEmployee:req.employee._id};
  const [rows,total]=await Promise.all([Enquiry.find(query).populate('service','title').sort({createdAt:-1}).skip(skip).limit(limit),Enquiry.countDocuments(query)]);
  return sendList(res,rows,{page,limit,total});
});
exports.createEnquiry = asyncHandler(async (req,res) => {
  const {name,phone,email,details,service}=req.body;
  if(!name||!phone||!details) throw ApiError.badRequest('Name, phone and enquiry details are required');
  if(service && !(await Service.findById(service))) throw ApiError.badRequest('Service not found');
  const enquiry=await Enquiry.create({enquiryId:newEnquiryId(),name,phone,email,details,service,source:'phone',createdByEmployee:req.employee._id});
  return sendSuccess(res,{enquiry},201);
});
exports.updateAppointment = asyncHandler(async(req,res)=>{
  const {status,jobNotes}=req.body;
  if(status!=='in-progress') throw ApiError.badRequest('Employees may only mark assigned appointments in progress; closure requires photo review');
  const appointment=await Appointment.findOne({_id:req.params.id,employee:req.employee._id});
  if(!appointment) throw ApiError.notFound('Assigned appointment not found');
  appointment.status=status;
  if(jobNotes!==undefined) appointment.jobNotes=jobNotes;
  await appointment.save();
  return sendSuccess(res,{appointment});
});
exports.requestClose = asyncHandler(async(req,res)=>{
  const appointment=await Appointment.findOne({_id:req.params.id,employee:req.employee._id});
  if(!appointment) throw ApiError.notFound('Assigned appointment not found');
  if(appointment.status!=='in-progress') throw ApiError.badRequest('Mark the appointment in progress before requesting closure');
  const files=req.files||[];
  if(files.length<1||files.length>2) throw ApiError.badRequest('Capture one or two site photos to request closure');
  const images=await uploadImages(files,{folder:'closures'});
  let closure=await AppointmentClosure.findOne({appointment:appointment._id});
  if(closure&&closure.status!=='rejected') throw ApiError.conflict('A closure request is already awaiting review or approved');
  if(closure){closure.images=images;closure.status='pending-review';closure.submittedBy=req.employee._id;closure.completedAt=new Date();closure.reviewedBy=undefined;closure.reviewedAt=undefined;closure.reviewNotes='';await closure.save();}
  else closure=await AppointmentClosure.create({appointment:appointment._id,images,status:'pending-review',submittedBy:req.employee._id,completedAt:new Date()});
  appointment.status='completion-requested';await appointment.save();
  notifyAdminsOfClosure(closure._id).catch((error) => console.error('[notification] Closure notice failed:', error.message));
  return sendSuccess(res,{closure,appointment},201);
});
