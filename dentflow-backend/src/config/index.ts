import dotenv from "dotenv";
import path from "path";

// Load environment file based on NODE_ENV
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });


if (!process.env.DATABASE_URL) {
  throw new Error('❌ FATAL: DATABASE_URL is not defined in environment variables!');
}

export const config = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiUrl: process.env.API_URL || 'http://localhost:3000',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9002',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'dentflow',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_min_32_chars',
    expiry: process.env.JWT_EXPIRY || '24h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

console.log('✅ Config loaded successfully!');
console.log(`   - Database: ${config.database.url}`);
console.log(`   - Redis: ${config.redis.url}`);
console.log(`   - MinIO: ${config.minio.endpoint}`);
