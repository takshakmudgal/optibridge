import { config } from "dotenv";

config();

const requiredEnvVars = ["SOCKET_API_KEY", "REDIS_URL"] as const;

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

export const ENV = {
  SOCKET_API_KEY: process.env.SOCKET_API_KEY!,
  REDIS_URL: process.env.REDIS_URL!,
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
} as const;
