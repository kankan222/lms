import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import { isOtpChallenge, login, resendOtp, verifyOtp } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { OtpChallengeResponseData } from "../types/auth";

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
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpChallenge, setOtpChallenge] = useState<OtpChallengeResponseData | null>(null);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(18)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(heroTranslateY, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(70),
        Animated.parallel([
          Animated.timing(formOpacity, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(formTranslateY, {
            toValue: 0,
            duration: 360,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, [formOpacity, formTranslateY, heroOpacity, heroTranslateY]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleLogin() {
    if (otpChallenge) {
      await handleVerifyOtp();
      return;
    }

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
      if (isOtpChallenge(data)) {
        setOtpChallenge(data);
        setCooldown(Number(data.resendAvailableInSeconds || 60));
        setOtp("");
        return;
      }

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

  async function handleVerifyOtp() {
    if (!otpChallenge) return;
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6 digit OTP.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await verifyOtp(otpChallenge.challengeId, otp.trim());
      await setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } catch (err: unknown) {
      const fallback = "Could not verify OTP.";
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

  async function handleResendOtp() {
    if (!otpChallenge) return;
    setResending(true);
    setError(null);
    try {
      const data = await resendOtp(otpChallenge.challengeId);
      setOtpChallenge(data);
      setCooldown(Number(data.resendAvailableInSeconds || 60));
      setOtp("");
      Alert.alert("OTP sent", "A new OTP has been sent to your registered phone number.");
    } catch (err: unknown) {
      const fallback = "Could not resend OTP.";
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
      setResending(false);
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
            <Animated.View
              style={[
                styles.hero,
                {
                  opacity: heroOpacity,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
              <Text style={[styles.title, { color: theme.text }]}>Welcome to KKV Group of Institutions</Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.form,
                { borderColor: theme.border, backgroundColor: theme.card },
                {
                  opacity: formOpacity,
                  transform: [{ translateY: formTranslateY }],
                },
              ]}
            >
              {error ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Login error</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {!otpChallenge ? (
                <>
                  <Text style={[styles.label, { color: theme.subText }]}>Email or phone</Text>
                  <TextInput
                    value={identifier}
                    onChangeText={(value) => {
                      setIdentifier(value);
                      if (error) setError(null);
                    }}
                    autoCapitalize="none"
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
                </>
              ) : (
                <>
                  <View style={[styles.otpNotice, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                    <Text style={[styles.otpTitle, { color: theme.text }]}>Verify OTP</Text>
                    <Text style={[styles.otpText, { color: theme.subText }]}>
                      Enter the 6 digit code sent to {otpChallenge.phone || "your registered phone"}.
                    </Text>
                  </View>
                  <Text style={[styles.label, { color: theme.subText }]}>OTP</Text>
                  <TextInput
                    value={otp}
                    onChangeText={(value) => {
                      setOtp(value.replace(/\D/g, "").slice(0, 6));
                      if (error) setError(null);
                    }}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    style={[styles.input, { borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }]}
                    editable={!submitting}
                    maxLength={6}
                  />
                  <View style={styles.otpActions}>
                    <Pressable
                      onPress={() => {
                        setOtpChallenge(null);
                        setOtp("");
                        setError(null);
                      }}
                      disabled={submitting || resending}
                    >
                      <Text style={[styles.passwordToggleText, { color: theme.text }]}>Back</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleResendOtp}
                      disabled={submitting || resending || cooldown > 0}
                    >
                      <Text
                        style={[
                          styles.passwordToggleText,
                          { color: theme.text },
                          (resending || cooldown > 0) && styles.disabledText,
                        ]}
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend OTP"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}

              <Pressable
                onPress={handleLogin}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.primary },
                  (pressed || submitting) && styles.buttonPressed,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color={theme.primaryText} />
                ) : (
                  <Text style={[styles.buttonText, { color: theme.primaryText }]}>
                    {otpChallenge ? "Verify and login" : "Login"}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
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
  otpNotice: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  otpTitle: {
    fontWeight: "800",
    marginBottom: 2,
  },
  otpText: {
    lineHeight: 18,
  },
  otpActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  disabledText: {
    opacity: 0.5,
  },
});
