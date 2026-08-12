import React, { Component, type ErrorInfo, type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { useAuthStore } from "./src/store/authStore";
import { AppThemeProvider, useAppTheme } from "./src/theme/AppThemeProvider";
import { AppAlertProvider } from "./src/components/feedback/AppAlertProvider";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

type FontDefaultTarget<T> = T & {
  defaultProps?: {
    style?: unknown;
    [key: string]: unknown;
  };
};

const defaultInterTextStyle = { fontFamily: "Inter_400Regular" };
const splashLogo = require("./assets/logo.png");
let defaultFontInstalled = false;

function applyDefaultFontFamily() {
  if (defaultFontInstalled) return;
  defaultFontInstalled = true;
  const textTarget = Text as unknown as FontDefaultTarget<typeof Text>;
  const inputTarget = TextInput as unknown as FontDefaultTarget<typeof TextInput>;

  textTarget.defaultProps = textTarget.defaultProps || {};
  textTarget.defaultProps.style = [textTarget.defaultProps.style, defaultInterTextStyle];

  inputTarget.defaultProps = inputTarget.defaultProps || {};
  inputTarget.defaultProps.style = [inputTarget.defaultProps.style, defaultInterTextStyle];

  const textRenderTarget = Text as unknown as { render?: (...args: unknown[]) => React.ReactElement };
  const inputRenderTarget = TextInput as unknown as { render?: (...args: unknown[]) => React.ReactElement };

  if (typeof textRenderTarget.render === "function") {
    const originalRender = textRenderTarget.render;
    textRenderTarget.render = function renderWithInter(...args: unknown[]) {
      const origin = originalRender.apply(this, args) as React.ReactElement<{ style?: unknown }>;
      return React.cloneElement(origin, {
        style: [defaultInterTextStyle, origin.props.style],
      });
    };
  }

  if (typeof inputRenderTarget.render === "function") {
    const originalRender = inputRenderTarget.render;
    inputRenderTarget.render = function renderInputWithInter(...args: unknown[]) {
      const origin = originalRender.apply(this, args) as React.ReactElement<{ style?: unknown }>;
      return React.cloneElement(origin, {
        style: [defaultInterTextStyle, origin.props.style],
      });
    };
  }
}

applyDefaultFontFamily();

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Root app error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>The app could not open.</Text>
          <Text style={styles.errorText}>{this.state.error.message || "Unknown startup error"}</Text>
          <Pressable style={styles.retryButton} onPress={() => this.setState({ error: null })}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

function AppContainer() {
  const { theme, isDark } = useAppTheme();
  const [splashDone, setSplashDone] = useState(false);
  const [fontsLoaded, fontLoadError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const appReady = (fontsLoaded || Boolean(fontLoadError)) && isHydrated;
  const showSplash = !splashDone || !appReady;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {appReady ? (
          <NavigationContainer>
            <StatusBar style={isDark ? "light" : "dark"} />
            <AppNavigator />
          </NavigationContainer>
        ) : null}
        {showSplash ? <AnimatedSplash theme={theme} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AnimatedSplash({ theme }: { theme: ReturnType<typeof useAppTheme>["theme"] }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const driftLoop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    pulseLoop.start();
    driftLoop.start();
    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [drift, pulse]);

  const iconScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.28],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0],
  });
  const translateY = drift.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -8, 0],
  });

  return (
    <View style={[styles.splashOverlay, { backgroundColor: theme.bg }]}>
      <Animated.View style={[styles.splashMarkWrap, { transform: [{ translateY }] }]}>
        <Animated.View
          style={[
            styles.splashRing,
            {
              borderColor: theme.primary,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.splashIconBox,
            {
              backgroundColor: "#ffffff",
              shadowColor: theme.primary,
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          <Image source={splashLogo} style={styles.splashLogo} resizeMode="contain" />
        </Animated.View>
      </Animated.View>
      <Text style={[styles.splashTitle, { color: theme.text }]}>KKV Group of Institutions</Text>
      <Text style={[styles.splashText, { color: theme.subText }]}>
        Learn with focus. Grow with purpose.
      </Text>
      <View style={styles.splashDots}>
        {[0, 1, 2].map((item) => (
          <Animated.View
            key={item}
            style={[
              styles.splashDot,
              {
                backgroundColor: theme.primary,
                opacity: pulse.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: item === 1 ? [0.35, 1, 0.35] : [1, 0.35, 1],
                }),
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <RootErrorBoundary>
      <AppThemeProvider>
        <AppAlertProvider>
          <AppContainer />
        </AppAlertProvider>
      </AppThemeProvider>
    </RootErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    zIndex: 10,
  },
  splashMarkWrap: {
    width: 112,
    height: 112,
    alignItems: "center",
    justifyContent: "center",
  },
  splashRing: {
    position: "absolute",
    width: 102,
    height: 102,
    borderRadius: 28,
    borderWidth: 2,
  },
  splashIconBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  splashLogo: {
    width: 76,
    height: 76,
  },
  splashTitle: {
    marginTop: 18,
    fontFamily: "Inter_800ExtraBold",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  splashText: {
    marginTop: 8,
    maxWidth: 280,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  splashDots: {
    marginTop: 22,
    flexDirection: "row",
    gap: 7,
  },
  splashDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorTitle: {
    color: "#0f172a",
    fontFamily: "Inter_800ExtraBold",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  errorText: {
    color: "#475569",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },
});
