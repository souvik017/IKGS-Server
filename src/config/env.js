require('dotenv').config();

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
};

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction,
  port: toInt(process.env.PORT, 5000),

  mongoUri: process.env.MONGODB_URI || 'mongodb+srv://souvikkdas17_db_user:anPtBmx8VtuxB0yl@cluster0.nxuct0i.mongodb.net/',
  mongoTransactions: toBool(process.env.MONGO_TRANSACTIONS, false),

  jwt: {
    secret: process.env.JWT_SECRET || 'insecure-dev-secret-change-me',
    expire: process.env.JWT_EXPIRE || '30d',
    cookieName: process.env.JWT_COOKIE_NAME || 'ikgs_token',
    csrfCookieName: 'ikgs_csrf',
  },

  cookie: {
    // In production the API is expected to be served over HTTPS.
    secure: toBool(process.env.COOKIE_SECURE, isProduction),
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAgeMs: toInt(process.env.COOKIE_MAX_AGE_MS, 30 * 24 * 60 * 60 * 1000),
  },

  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,https://ikgssol2.netlify.app/')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  bcryptSaltRounds: toInt(process.env.BCRYPT_SALT_ROUNDS, 12),

  rateLimit: {
    global: toInt(process.env.RATE_LIMIT_GLOBAL, 300),
    public: toInt(process.env.RATE_LIMIT_PUBLIC, 20),
    login: toInt(process.env.RATE_LIMIT_LOGIN, 10),
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'ikgs',
  },

  upload: {
    maxFileSize: toInt(process.env.MAX_FILE_SIZE, 5 * 1024 * 1024),
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    // When Cloudinary is not configured, fall back to local disk storage.
    provider: process.env.UPLOAD_PROVIDER || (process.env.CLOUDINARY_CLOUD_NAME ? 'cloudinary' : 'local'),
    localDir: process.env.UPLOAD_DIR || 'uploads',
  },

  mail: {
    host: process.env.SMTP_HOST || '',
    port: toInt(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'no-reply@ikgssolution.com',
  },

  seed: {
    adminName: process.env.ADMIN_NAME || 'IKGS Administrator',
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
  },

  pagination: {
    defaultLimit: toInt(process.env.DEFAULT_LIMIT, 10),
    maxLimit: toInt(process.env.MAX_LIMIT, 100),
  },
};

module.exports = config;
