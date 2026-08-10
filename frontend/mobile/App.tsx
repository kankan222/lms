import React, { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
  const { isDark } = useAppTheme();
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

  if (!fontsLoaded && !fontLoadError) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isHydrated) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style={isDark ? "light" : "dark"} />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
