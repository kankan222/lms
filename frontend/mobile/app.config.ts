import "dotenv/config";
import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "School Mobile",
  slug: "school-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
      backgroundColor: "#E6F4FE",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: ["expo-secure-store"],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  },
};

export default config;
