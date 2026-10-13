/**
 * Isolated integration test for POST /api/auth/bootstrap.
 *
 * This runs against its own empty in-memory database because the bootstrap
 * endpoint is only reachable while no admin account exists — the shared
 * workflows suite already has an admin, so it can never exercise the success
 * path.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let app;
let superAdminToken;

const payload = {
  name: 'Owner',
  email: 'Owner@Example.com',
  password: 'Str0ngPass!',
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(process.env.MONGODB_URI);

  // eslint-disable-next-line global-require
  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe('Admin bootstrap', () => {
  test('rejects an invalid payload', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap')
      .send({ name: 'Owner', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(['email', 'password']);
  });

  test('creates the first super_admin without authentication', async () => {
    const res = await request(app).post('/api/auth/bootstrap').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.admin.email).toBe('owner@example.com');
    expect(res.body.data.admin.role).toBe('super_admin');
    // The hash must never leave the server.
    expect(res.body.data.admin.passwordHash).toBeUndefined();

    const stored = await mongoose.connection.db
      .collection('admins')
      .findOne({ email: 'owner@example.com' });
    expect(stored.passwordHash).not.toBe(payload.password);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  test('locks itself out once an admin exists', async () => {
    const res = await request(app)
      .post('/api/auth/bootstrap')
      .send({ ...payload, email: 'another@example.com' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    const admins = await mongoose.connection.db.collection('admins').countDocuments();
    expect(admins).toBe(1);
  });

  test('the bootstrapped admin can log in and create further admins', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner@example.com', password: payload.password });

    expect(login.status).toBe(200);
    superAdminToken = login.body.data.token;
    expect(superAdminToken).toBeTruthy();

    const created = await request(app)
      .post('/api/auth/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Front Desk',
        email: 'frontdesk@example.com',
        password: 'Str0ngPass!',
        role: 'admin',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.admin.role).toBe('admin');
    expect(created.body.data.admin.passwordHash).toBeUndefined();
  });

  test('an unknown role is rejected on POST /api/auth/admins', async () => {
    const res = await request(app)
      .post('/api/auth/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Bad Role',
        email: 'badrole@example.com',
        password: 'Str0ngPass!',
        role: 'owner',
      });

    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.field === 'role')).toBe(true);
  });

  test('POST /api/auth/admins still requires a super_admin token', async () => {
    const res = await request(app).post('/api/auth/admins').send({
      name: 'Anonymous',
      email: 'anonymous@example.com',
      password: 'Str0ngPass!',
    });

    expect(res.status).toBe(401);
  });
});
