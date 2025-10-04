import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key];

  if (!value && fallback!) {
    throw new Error(`❌ Missing environment variable: ${key}`);
  }

  return value || fallback!;
};

export const env = {
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: parseInt(getEnv("PORT", "5000"), 10),
  MONGO_URI: getEnv("MONGO_URI"),
  REDIS_URI: getEnv("REDIS_URI"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRY: getEnv("JWT_EXPIRY", "1h"),
  HOSTED_APP_API_URL: getEnv("HOSTED_APP_API_URL"),
};
