// import dotenv from "dotenv";

// dotenv.config();

// const getEnv = (key: string, fallback?: string): string => {
//   const value = process.env[key];

//   if (!value && fallback!) {
//     throw new Error(`❌ Missing environment variable: ${key}`);
//   }

//   return value || fallback!;
// };

// export const env = {
//   NODE_ENV: getEnv("NODE_ENV", "development"),
//   PORT: parseInt(getEnv("PORT", "5000"), 10),
//   MONGO_URI: getEnv("MONGO_URI"),
//   REDIS_URI: getEnv("REDIS_URI"),
//   JWT_SECRET: getEnv("JWT_SECRET"),
//   JWT_EXPIRY: getEnv("JWT_EXPIRY", "1h"),
//   HOSTED_APP_API_URL: getEnv("HOSTED_APP_API_URL"),
//   BETTING_DURATION: getEnv("BETTING_DURATION", "30000"),
//   REVEAL_DURATION: getEnv("REVEAL_DURATION", "5000"),
//   PREPARE_DURATION: getEnv("PREPARE_DURATION", "5000"),
//   COMPANY_PROFIT_PERCENT: getEnv("COMPANY_PROFIT_PERCENT"),
//   DEFAULT_MULTIPLIER: getEnv("DEFAULT_MULTIPLIER"),
// };


// New Version Start

// src/config/env.ts
import dotenv from "dotenv";
dotenv.config();

/** True if s is undefined, null, or empty string. */
const isBlank = (s: unknown): s is undefined | null | "" =>
  s === undefined || s === null || s === "";

/** Basic getter: throw only when missing AND no fallback provided. */
function getEnv(key: string, fallback?: string): string {
  const val = process.env[key];
  if (isBlank(val)) {
    if (isBlank(fallback)) {
      throw new Error(`❌ Missing environment variable: ${key}`);
    }
    return String(fallback);
  }
  return String(val);
}

/** Parse integer with fallback and friendly errors. */
function getEnvInt(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (isBlank(raw)) {
    if (fallback === undefined) {
      throw new Error(`❌ Missing numeric env: ${key}`);
    }
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`❌ Invalid number for ${key}: "${raw}"`);
  }
  return n;
}

/**
 * Parse duration to milliseconds.
 * Accepts:
 *   - plain numbers like "5000" (ms) or "5" (treated as seconds if < 1000)
 *   - strings like "5s", "2m", "1h", "500ms"
 */
function getEnvMs(key: string, fallbackMs?: number): number {
  const raw = process.env[key];
  if (isBlank(raw)) {
    if (fallbackMs === undefined) {
      throw new Error(`❌ Missing duration env: ${key}`);
    }
    return fallbackMs;
  }
  return parseDurationMs(raw);
}

/** Convert common duration strings into ms. */
function parseDurationMs(input: string): number {
  const s = input.trim().toLowerCase();
  // explicit units
  if (s.endsWith("ms")) return numOrThrow(s.slice(0, -2));
  if (s.endsWith("s")) return numOrThrow(s.slice(0, -1)) * 1000;
  if (s.endsWith("m")) return numOrThrow(s.slice(0, -1)) * 60_000;
  if (s.endsWith("h")) return numOrThrow(s.slice(0, -1)) * 3_600_000;

  // no unit → numeric heuristic: <1000 = seconds, else = ms
  const n = numOrThrow(s);
  return n < 1000 ? n * 1000 : n;
}

function numOrThrow(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`❌ Invalid numeric value: "${raw}"`);
  return n;
}

export const env = {
  NODE_ENV: getEnv("NODE_ENV", "development"),
  PORT: getEnvInt("PORT", 5000),

  MONGO_URI: getEnv("MONGO_URI"),
  REDIS_URI: getEnv("REDIS_URI"),
  JWT_SECRET: getEnv("JWT_SECRET"),
  JWT_EXPIRY: getEnv("JWT_EXPIRY", "1h"),

  HOSTED_APP_API_URL: getEnv("HOSTED_APP_API_URL", ""),

  // Durations normalized to milliseconds
  BETTING_DURATION_MS: getEnvMs("BETTING_DURATION", 30_000), // "30000" or "30s"
  REVEAL_DURATION_MS:  getEnvMs("REVEAL_DURATION", 5_000),   // "5000" or "5s"
  PREPARE_DURATION_MS: getEnvMs("PREPARE_DURATION", 5_000),

  COMPANY_PROFIT_PERCENT: getEnvInt("COMPANY_PROFIT_PERCENT", 10),
  DEFAULT_MULTIPLIER: getEnvInt("DEFAULT_MULTIPLIER", 1),
};
