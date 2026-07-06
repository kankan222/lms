import { z } from "zod";

const DEFAULT_API_BASE_URL = "https://kalongkapilividyapith.com/api/v1";

const envSchema = z.object({
  EXPO_PUBLIC_API_BASE_URL: z.string().url(),
});

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL,
});

export const ENV = {
  API_BASE_URL: parsed.success ? parsed.data.EXPO_PUBLIC_API_BASE_URL : DEFAULT_API_BASE_URL,
};
