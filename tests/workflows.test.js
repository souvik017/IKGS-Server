const request = require('supertest');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { execFileSync } = require('child_process');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let adminToken;
let serviceId;
let bookingId;
let bookingMongoId;
let appointmentId;
let employeeId;
let customerId;
let quotationId;
let invoiceId;
let inventoryItemId;
let closureAppointmentId;
let reviewId;

const auth = (req) => req.set('Authorization', `Bearer ${adminToken}`);

const png = () =>
  sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 37, g: 99, b: 235 } } })
    .png()
    .toBuffer();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  // eslint-disable-next-line global-require
  app = require('../src/app');
  // eslint-disable-next-line global-require
  const Admin = require('../src/models/Admin');

  await Admin.create({
    name: 'Test Admin',
    email: 'admin@test.local',
    passwordHash: await Admin.hashPassword('Password123!'),
    role: 'super_admin',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('1. Authentication', () => {
  test('unauthenticated requests are rejected', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('admin can log in and fetch profile', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.local', password: 'Password123!' });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTruthy();
    adminToken = login.body.data.token;

    const me = await auth(request(app).get('/api/auth/me'));
    expect(me.status).toBe(200);
    expect(me.body.data.admin.email).toBe('admin@test.local');
  });

  test('logout succeeds', async () => {
    const res = await auth(request(app).post('/api/auth/logout'));
    expect(res.status).toBe(200);
  });
});

describe('2. Service catalogue', () => {
  test('admin creates a service', async () => {
    const res = await auth(request(app).post('/api/services')).send({
      title: 'Termite Control Test',
      shortDescription: 'Test termite service',
      startingPrice: 1500,
    });
    expect(res.status).toBe(201);
    serviceId = res.body.data.service._id;
  });

  test('public can read active services', async () => {
    const res = await request(app).get('/api/public/services');
    expect(res.status).toBe(200);
    expect(res.body.data.services.length).toBeGreaterThan(0);
  });
});

describe('3. Public booking workflow', () => {
  test('public submission creates a booking record', async () => {
    const res = await request(app).post('/api/public/bookings').send({
      name: 'Public Customer',
      phone: '9800000001',
      email: 'public@example.com',
      address: '12 Test Street',
      service: serviceId,
      preferredDate: new Date().toISOString(),
      preferredTime: '10:00',
      message: 'Please call before arriving',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.booking.bookingId).toMatch(/^BK-/);
    bookingId = res.body.data.booking.bookingId;
  });

  test('booking is visible in the admin panel', async () => {
    const res = await auth(request(app).get(`/api/bookings?search=${bookingId}`));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    customerId = res.body.data[0].customer._id;
    bookingMongoId = res.body.data[0]._id;
  });

  test('invalid public booking is rejected', async () => {
    const res = await request(app).post('/api/public/bookings').send({ name: 'No Phone' });
    expect(res.status).toBe(422);
  });
});

describe('4. Public enquiry workflow', () => {
  test('public submission creates an enquiry record', async () => {
    const res = await request(app).post('/api/public/enquiries').send({
      name: 'Enquiry Person',
      phone: '9800000002',
      details: 'Need rodent control',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^ENQ-/);
  });

  test('admin can update enquiry status and add follow-ups via conversion', async () => {
    const list = await auth(request(app).get('/api/enquiries'));
    const enquiryId = list.body.data[0]._id;

    const status = await auth(request(app).put(`/api/enquiries/${enquiryId}/status`)).send({
      status: 'in-progress',
      note: 'Called customer',
    });
    expect(status.status).toBe(200);
    expect(status.body.data.enquiry.status).toBe('in-progress');
    expect(status.body.data.enquiry.followUps.length).toBe(1);

    const bad = await auth(request(app).put(`/api/enquiries/${enquiryId}/status`)).send({ status: 'nonsense' });
    expect(bad.status).toBe(400);

    const convert = await auth(request(app).post(`/api/enquiries/${enquiryId}/convert`)).send({
      createBooking: true,
    });
    expect(convert.status).toBe(200);
    expect(convert.body.data.enquiry.status).toBe('converted');
    expect(convert.body.data.booking.bookingId).toMatch(/^BK-/);

    // Reuse, do not duplicate: converting the same lead reuses the customer.
    const again = await auth(request(app).post(`/api/enquiries/${enquiryId}/convert`)).send({
      customerId: convert.body.data.customer._id,
      createBooking: false,
    });
    expect(again.status).toBe(200);
    expect(again.body.data.customer._id).toBe(convert.body.data.customer._id);
  });
});

describe('5. Booking status and conversion', () => {
  test('admin can update booking status', async () => {
    const res = await auth(request(app).put(`/api/bookings/${bookingMongoId}/status`)).send({ status: 'pending' });
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('pending');
  });

  test('booking converts into a linked appointment', async () => {
    const emp = await auth(request(app).post('/api/employees')).send({
      name: 'Field Technician',
      phone: '9800000003',
      email: 'tech@example.com',
    });
    expect(emp.status).toBe(201);
    employeeId = emp.body.data.employee._id;

    const id = bookingMongoId;

    const res = await auth(request(app).post(`/api/bookings/${id}/convert`)).send({
      date: new Date().toISOString(),
      employee: employeeId,
    });
    expect(res.status).toBe(201);
    appointmentId = res.body.data.appointment._id;
    expect(res.body.data.appointment.booking).toBe(id);

    // Second conversion must be blocked.
    const dup = await auth(request(app).post(`/api/bookings/${id}/convert`)).send({ date: new Date().toISOString() });
    expect(dup.status).toBe(409);
  });

  test('appointment can be assigned to an employee', async () => {
    const res = await auth(request(app).put(`/api/appointments/${appointmentId}/assign`)).send({
      employeeId,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe('assigned');
  });

  test('invalid appointment id returns 400, missing id returns 404', async () => {
    const bad = await auth(request(app).get('/api/appointments/not-an-id'));
    expect(bad.status).toBe(400);
    const missing = await auth(request(app).get('/api/appointments/000000000000000000000000'));
    expect(missing.status).toBe(404);
  });
});

describe('6. Customer profile shows linked records', () => {
  test('linked records are returned', async () => {
    const res = await auth(request(app).get(`/api/customers/${customerId}`));
    expect(res.status).toBe(200);
    expect(res.body.data.records.bookings.length).toBeGreaterThan(0);
    expect(res.body.data.records.appointments.length).toBeGreaterThan(0);
  });
});

describe('7. Quotations', () => {
  test('totals are calculated on the server, ignoring client totals', async () => {
    const res = await auth(request(app).post('/api/quotations')).send({
      customer: customerId,
      items: [
        { item: 'Treatment A', quantity: 2, unitPrice: 1000, discount: 100 },
        { item: 'Treatment B', quantity: 1, unitPrice: 500 },
      ],
      discount: 200,
      tax: 99999, // must be ignored
      total: 1, // must be ignored
    });
    expect(res.status).toBe(201);
    quotationId = res.body.data.quotation._id;
    const q = res.body.data.quotation;
    // gross = 2000 + 500 = 2500; line discount 100 + doc discount 200; tax disabled
    expect(q.subtotal).toBe(2500);
    expect(q.discount).toBe(200);
    expect(q.total).toBe(2200);
  });

  test('quotation PDF matches the saved records', async () => {
    const res = await auth(request(app).get(`/api/quotations/${quotationId}/pdf`));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.length).toBeGreaterThan(1000);
  });
});

describe('8. Invoices', () => {
  test('appointment-based invoice works', async () => {
    const res = await auth(request(app).post('/api/invoices/appointment')).send({
      appointment: appointmentId,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.invoice.invoiceType).toBe('appointment');
    expect(res.body.data.invoice.appointment).toBe(appointmentId);
    invoiceId = res.body.data.invoice._id;
  });

  test('general/monthly invoice works', async () => {
    const res = await auth(request(app).post('/api/invoices')).send({
      customer: customerId,
      billingPeriod: '2026-09',
      items: [{ item: 'Monthly service', quantity: 1, unitPrice: 2500 }],
      dueDate: new Date().toISOString(),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.invoice.invoiceType).toBe('general');
    expect(res.body.data.invoice.billingPeriod).toBe('2026-09');
    expect(res.body.data.invoice.total).toBe(2500);
  });

  test('payment status can be updated to partial then paid', async () => {
    const partial = await auth(request(app).put(`/api/invoices/${invoiceId}/payment`)).send({
      amountPaid: 100,
      paymentMethod: 'cash',
    });
    expect(partial.status).toBe(200);
    expect(partial.body.data.invoice.paymentStatus).toBe('partially-paid');
    expect(partial.body.data.invoice.balanceDue).toBeGreaterThan(0);

    const full = await auth(request(app).put(`/api/invoices/${invoiceId}/payment`)).send({
      amountPaid: partial.body.data.invoice.total,
    });
    expect(full.body.data.invoice.paymentStatus).toBe('paid');
    expect(full.body.data.invoice.balanceDue).toBe(0);
  });

  test('invoice PDF renders', async () => {
    const res = await auth(request(app).get(`/api/invoices/${invoiceId}/pdf?download=1`));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.length).toBeGreaterThan(1000);
  });
});

describe('9. Inventory', () => {
  beforeAll(async () => {
    const res = await auth(request(app).post('/api/inventory/items')).send({
      itemName: 'Cockroach Gel',
      category: 'Chemicals',
      quantity: 10,
      unit: 'piece',
      purchasePrice: 250,
      lowStockThreshold: 5,
    });
    inventoryItemId = res.body.data.item._id;
  });

  test('stock-in increases inventory', async () => {
    const res = await auth(request(app).post('/api/inventory/movements')).send({
      item: inventoryItemId,
      type: 'stock-in',
      quantity: 5,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.item.quantity).toBe(15);
    expect(res.body.data.transaction.type).toBe('stock-in');
  });

  test('stock-out decreases inventory and records a transaction', async () => {
    const res = await auth(request(app).post('/api/inventory/movements')).send({
      item: inventoryItemId,
      type: 'stock-out',
      quantity: 12,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.item.quantity).toBe(3);
    expect(res.body.data.transaction.balanceAfter).toBe(3);
  });

  test('invalid stock-out is rejected', async () => {
    const res = await auth(request(app).post('/api/inventory/movements')).send({
      item: inventoryItemId,
      type: 'stock-out',
      quantity: 999,
    });
    expect(res.status).toBe(400);

    const item = await auth(request(app).get(`/api/inventory/items/${inventoryItemId}`));
    expect(item.body.data.item.quantity).toBe(3); // unchanged
  });

  test('low-stock detection and usage report work', async () => {
    const low = await auth(request(app).get('/api/inventory/low-stock'));
    expect(low.status).toBe(200);
    expect(low.body.data.items.some((i) => i._id === inventoryItemId)).toBe(true);

    const report = await auth(request(app).get('/api/inventory/report'));
    expect(report.status).toBe(200);
    expect(report.body.data.usage.length).toBeGreaterThan(0);
  });
});

describe('10. Appointment closure and reviews', () => {
  beforeAll(async () => {
    // Create a fresh appointment to close.
    const res = await auth(request(app).post('/api/appointments')).send({
      customer: customerId,
      date: new Date().toISOString(),
      time: '14:00',
      employee: employeeId,
    });
    closureAppointmentId = res.body.data.appointment._id;
  });

  test('closure accepts up to two images and records completion time', async () => {
    const img = await png();
    const res = await auth(request(app).post('/api/closures'))
      .field('appointment', closureAppointmentId)
      .field('rating', '5')
      .field('comments', 'Great service')
      .field('closingRemarks', 'Completed on schedule')
      .attach('images', img, 'a.png')
      .attach('images', img, 'b.png');

    expect(res.status).toBe(201);
    expect(res.body.data.closure.images.length).toBe(2);
    expect(res.body.data.closure.completedAt).toBeTruthy();
    expect(res.body.data.appointment.status).toBe('completed');
    reviewId = res.body.data.closure._id;
  });

  test('a duplicate closure is prevented', async () => {
    const res = await auth(request(app).post('/api/closures')).field('appointment', closureAppointmentId);
    expect(res.status).toBe(409);
  });

  test('more than two images are rejected', async () => {
    const other = await auth(request(app).post('/api/appointments')).send({
      customer: customerId,
      date: new Date().toISOString(),
      time: '16:00',
    });
    const img = await png();
    const res = await auth(request(app).post('/api/closures'))
      .field('appointment', other.body.data.appointment._id)
      .attach('images', img, 'a.png')
      .attach('images', img, 'b.png')
      .attach('images', img, 'c.png');
    expect(res.status).toBe(400);
  });

  test('only approved reviews appear publicly', async () => {
    const before = await request(app).get('/api/public/testimonials');
    expect(before.body.data.testimonials.length).toBe(0);

    const reviewList = await auth(request(app).get('/api/reviews'));
    expect(reviewList.body.data.length).toBeGreaterThan(0);
    const pendingReviewId = reviewList.body.data[0]._id;
    expect(reviewList.body.data[0].status).toBe('pending');

    const approve = await auth(request(app).put(`/api/reviews/${pendingReviewId}/status`)).send({
      status: 'approved',
    });
    expect(approve.status).toBe(200);

    const after = await request(app).get('/api/public/testimonials');
    expect(after.body.data.testimonials.length).toBe(1);
    expect(after.body.data.testimonials[0].name).toBeTruthy();
  });
});

describe('11. Tax configuration', () => {
  test('tax is applied only when enabled in settings', async () => {
    await auth(request(app).put('/api/settings')).send({
      tax: { enabled: true, label: 'GST', rate: 18 },
    });

    const res = await auth(request(app).post('/api/quotations')).send({
      customer: customerId,
      items: [{ item: 'Taxed service', quantity: 1, unitPrice: 1000 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.quotation.tax).toBe(180);
    expect(res.body.data.quotation.total).toBe(1180);

    await auth(request(app).put('/api/settings')).send({ tax: { enabled: false, rate: 0 } });
  });
});

describe('12. Dashboard', () => {
  test('dashboard summary reflects real data', async () => {
    const res = await auth(request(app).get('/api/dashboard/summary'));
    expect(res.status).toBe(200);
    const s = res.body.data.summary;
    expect(s.totalCustomers).toBeGreaterThan(0);
    expect(s.totalEnquiries).toBeGreaterThan(0);
    expect(typeof s.lowStockItems).toBe('number');
  });
});

describe('13. Gallery', () => {
  let publishedId;
  let draftId;

  test('admin can create a published gallery image (URL source)', async () => {
    const res = await auth(request(app).post('/api/gallery')).send({
      title: 'Team at work',
      alt: 'IKGS technicians preparing treatment equipment',
      caption: 'Preparing for a scheduled service',
      category: 'Field Work',
      image: 'https://example.com/team.jpg',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.image.published).toBe(true);
    publishedId = res.body.data.image._id;
  });

  test('alt text is required for accessibility', async () => {
    const res = await auth(request(app).post('/api/gallery')).send({
      title: 'No alt',
      image: 'https://example.com/x.jpg',
    });
    expect(res.status).toBe(400);
  });

  test('an unpublished image is created hidden', async () => {
    const res = await auth(request(app).post('/api/gallery')).send({
      title: 'Draft image',
      alt: 'Draft placeholder',
      image: 'https://example.com/draft.jpg',
      published: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.image.published).toBe(false);
    draftId = res.body.data.image._id;
  });

  test('public gallery exposes only published images', async () => {
    const res = await request(app).get('/api/public/gallery');
    expect(res.status).toBe(200);
    const ids = res.body.data.images.map((i) => i._id);
    expect(ids).toContain(publishedId);
    expect(ids).not.toContain(draftId);
  });

  test('public gallery requires authentication for management actions', async () => {
    const res = await request(app).get('/api/gallery');
    expect(res.status).toBe(401);
  });

  test('image can be published, reordered and deleted', async () => {
    const publish = await auth(request(app).put(`/api/gallery/${draftId}`)).send({ published: true });
    expect(publish.status).toBe(200);
    expect(publish.body.data.image.published).toBe(true);

    const publicAfter = await request(app).get('/api/public/gallery');
    expect(publicAfter.body.data.images.map((i) => i._id)).toContain(draftId);

    const reorder = await auth(request(app).put('/api/gallery/reorder')).send({
      order: [
        { id: draftId, displayOrder: 1 },
        { id: publishedId, displayOrder: 2 },
      ],
    });
    expect(reorder.status).toBe(200);

    const del = await auth(request(app).delete(`/api/gallery/${draftId}`));
    expect(del.status).toBe(200);

    const publicFinal = await request(app).get('/api/public/gallery');
    expect(publicFinal.body.data.images.map((i) => i._id)).not.toContain(draftId);
  });
});

describe('14. Seed script', () => {
  test('runs without deleting existing data and is idempotent', async () => {
    const customersBefore = await mongoose.connection.db.collection('customers').countDocuments();

    const runSeed = () =>
      execFileSync('node', [path.join(__dirname, '..', 'src', 'scripts', 'seed.js')], {
        env: {
          ...process.env,
          MONGODB_URI: mongod.getUri(),
          ADMIN_EMAIL: 'seeded@ikgs.local',
          ADMIN_PASSWORD: 'SeedPassword123!',
        },
        stdio: 'pipe',
      });

    runSeed();
    runSeed(); // second run must not duplicate

    const admins = await mongoose.connection.db
      .collection('admins')
      .countDocuments({ email: 'seeded@ikgs.local' });
    expect(admins).toBe(1);

    const customersAfter = await mongoose.connection.db.collection('customers').countDocuments();
    expect(customersAfter).toBe(customersBefore);

    const services = await mongoose.connection.db.collection('services').countDocuments();
    expect(services).toBeGreaterThan(1);
  });
});
