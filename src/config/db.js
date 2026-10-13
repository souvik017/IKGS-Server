const mongoose = require('mongoose');
const config = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = config.mongoUri) {
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
