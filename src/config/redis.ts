import Redis from "ioredis";
import { env } from "./env";

let redis: Redis;

export const connectRedis = () => {
  redis = new Redis(env.REDIS_URI);

  redis.on("connect", () => console.log("Redis connection successfull"));
  redis.on("error", (err: any) => console.log("Redis connection failed", err?.message || err));

  return redis;
};

export const getRedis = () => {
  if (redis) {
    throw new Error("Redis not initialized, Call connectRedis() first");
  }
  return redis;
};
