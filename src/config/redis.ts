import { createClient } from "redis";
import { ENV } from "./env";

const redisClient = createClient({
  url: ENV.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
await redisClient.connect();

export default redisClient;
