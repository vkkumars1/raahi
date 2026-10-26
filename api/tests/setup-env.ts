process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/raahi_test";
process.env.JWT_SECRET = "test-jwt-secret-test-jwt-secret";
process.env.OTP_PEPPER = "test-otp-pepper-test-otp-pepper";
process.env.FRONTEND_URL = "http://localhost:3000";
delete process.env.REDIS_URL; // unit tests use the in-memory KV
