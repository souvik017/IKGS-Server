const app = require('./app');
const config = require('./config/env');
const { connectDB } = require('./config/db');

async function start() {
  try {
    await connectDB();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`IKGS API listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();

module.exports = app;
