import "dotenv/config";
import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Kalong Kapili Vidyapith",
  slug: "kalong-kapili-vidyapith",
  version: "1.1.5",
  orientation: "portrait",
  icon: "./assets/splash-icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.kalongkapilividyapith.mobile",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.kalongkapilividyapith.mobile",
    versionCode: 27,
    blockedPermissions: [
      "android.permission.CAMERA",
    ],
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/logo.png",
  },
  plugins: [
    "expo-secure-store",
    "expo-font",
    [
      "expo-notifications",
      {
        color: "#da271f",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Allow Kalong Kapili Vidyapith to record voice messages.",
      },
    ],
  ],
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    eas: {
      projectId: "fba1d24e-70b5-462a-9cc2-aa3b038ad327",
    },
  },
};

export default config;
