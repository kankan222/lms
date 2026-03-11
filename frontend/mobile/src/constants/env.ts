import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().url(),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
});

if (!parsed.success) {
  throw new Error("Invalid or missing EXPO_PUBLIC_API_BASE_URL in .env");
}

export const ENV = {
  API_BASE_URL: parsed.data.EXPO_PUBLIC_API_BASE_URL,
};
