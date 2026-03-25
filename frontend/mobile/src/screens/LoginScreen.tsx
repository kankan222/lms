import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { login } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { useAppTheme } from "../theme/AppThemeProvider";

function validateCredentials(identifier: string, password: string) {
  const credential = identifier.trim();
  const pass = password.trim();

  if (!credential || !pass) {
    return "Email/phone and password are required.";
  }

  if (credential.includes("@")) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credential)) {
      return "Enter a valid email address.";
    }
    return null;
  }

  const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
  const digitCount = credential.replace(/\D/g, "").length;
  if (!phoneRegex.test(credential) || digitCount < 7 || digitCount > 15) {
    return "Enter a valid phone number.";
  }

  return null;
}

export default function LoginScreen() {
  const { theme } = useAppTheme();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    const credential = identifier.trim();
    const validationError = validateCredentials(credential, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await login(credential, password);
      await setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } catch (err: unknown) {
      const fallback = "Login failed. Please check your credentials.";
      const message =
        typeof err === "object" &&
        err &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message === "string"
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : fallback;
      setError(message || fallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.hero}>
              <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={[styles.title, { color: theme.text }]}>Welcome to KKV Group of Institutions</Text>
            </View>

            <View style={[styles.form, { borderColor: theme.border, backgroundColor: theme.card }]}>
              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Login error</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={[styles.label, { color: theme.subText }]}>Email or phone</Text>
              <TextInput
                value={identifier}
                onChangeText={(value) => {
                  setIdentifier(value);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                placeholder="m@example.com or 9876543210"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                editable={!submitting}
              />
              <Text style={[styles.label, { color: theme.subText }]}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) setError(null);
                }}
                secureTextEntry={!showPassword}
                placeholder="Password"
                placeholderTextColor={theme.mutedText}
                style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                editable={!submitting}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                disabled={submitting}
                style={styles.passwordToggle}
              >
                <Text style={[styles.passwordToggleText, { color: theme.text }]}>
                  {showPassword ? "Hide password" : "Show password"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleLogin}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.button,
                  (pressed || submitting) && styles.buttonPressed,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  hero: {
    alignItems: "center",
    marginBottom: 28,
    gap: 10,
  },
  logo: {
    width: 132,
    height: 132,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  form: {
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: 18,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorTitle: {
    color: "#991b1b",
    fontWeight: "800",
    marginBottom: 2,
  },
  errorText: {
    color: "#b91c1c",
    lineHeight: 18,
  },
  label: {
    color: "#334155",
    fontWeight: "700",
    marginBottom: -4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    color: "#0f172a",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  passwordToggle: {
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  passwordToggleText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
});
