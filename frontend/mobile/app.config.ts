import "dotenv/config";
import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Kalong Kapili Vidyapith",
  slug: "kalong-kapili-vidyapith",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/logo.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/logo.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.kalongkapilividyapith.mobile",
  },
  android: {
    package: "com.kalongkapilividyapith.mobile",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
      backgroundColor: "#E6F4FE",
    },
  },
  web: {
    favicon: "./assets/logo.png",
  },
  plugins: ["expo-secure-store"],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: {
      projectId: "fba1d24e-70b5-462a-9cc2-aa3b038ad327",
    },
  },
};

export default config;
