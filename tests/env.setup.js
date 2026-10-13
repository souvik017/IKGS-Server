process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-integration-tests';
process.env.JWT_EXPIRE = '1h';
process.env.UPLOAD_PROVIDER = 'local';
process.env.RATE_LIMIT_PUBLIC = '1000';
process.env.RATE_LIMIT_LOGIN = '1000';
process.env.RATE_LIMIT_GLOBAL = '1000';
process.env.CORS_ORIGIN = 'http://localhost:5173';
