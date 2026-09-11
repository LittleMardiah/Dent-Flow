import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Skip dotenv di Vercel: env vars udah diinject langsung ke process.env oleh Vercel.
// dotenv cuma dipake di local development.
if (process.env.VERCEL !== '1') {
  // Load environment file based on NODE_ENV
  const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
  const envPath = path.resolve(process.cwd(), envFile);

  // Baca file .env secara manual dan set ke process.env (paksa override)
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const parsed = dotenv.parse(envContent);
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
    console.log(`✅ Loaded ${Object.keys(parsed).length} variables from ${envFile}`);
  } else {
    console.warn(`⚠️ Environment file ${envFile} not found, using system env`);
  }
}

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
    url: process.env.REDIS_URL || 'redis://localhost:6379',
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
  noShow: {
    graceMinutes: parseInt(process.env.NO_SHOW_GRACE_MINUTES || "15", 10),
  },
};
