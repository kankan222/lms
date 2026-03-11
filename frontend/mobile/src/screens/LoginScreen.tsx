import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { login } from "../services/authService";
import { useAuthStore } from "../store/authStore";

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
  const setAuth = useAuthStore((state) => state.setAuth);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    const credential = identifier.trim();
    const validationError = validateCredentials(credential, password);
    if (validationError) {
      Alert.alert("Validation", validationError);
      return;
    }

    setSubmitting(true);
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
      Alert.alert("Login Error", message || fallback);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>School Management</Text>
        <Text style={styles.subtitle}>Sign in with email or phone</Text>

        <View style={styles.form}>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            placeholder="Email / Phone"
            style={styles.input}
            editable={!submitting}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="Password"
            style={styles.input}
            editable={!submitting}
          />
          <Pressable
            onPress={() => setShowPassword((prev) => !prev)}
            disabled={submitting}
            style={styles.passwordToggle}
          >
            <Text style={styles.passwordToggleText}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#64748b",
  },
  form: {
    marginTop: 28,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    height: 48,
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
    fontWeight: "500",
  },
});
