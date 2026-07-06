import { Component, type ErrorInfo, type ReactNode, useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { useAuthStore } from "./src/store/authStore";
import { AppThemeProvider, useAppTheme } from "./src/theme/AppThemeProvider";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

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

  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
        <AppContainer />
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
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  errorText: {
    color: "#475569",
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
    fontWeight: "700",
  },
});
