import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { isOtpChallenge, login, resendOtp, verifyOtp } from "../services/authService";
import { useAuthStore } from "../store/authStore";
import { useAppTheme } from "../theme/AppThemeProvider";
import type { OtpChallengeResponseData } from "../types/auth";

const logoSource = require("../../assets/logo.png");

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
  const [notice, setNotice] = useState<string | null>(null);
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
      setNotice(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await login(credential, password);
      if (isOtpChallenge(data)) {
        setOtpChallenge(data);
        setCooldown(Number(data.resendAvailableInSeconds || 60));
        setOtp("");
        setNotice("OTP sent to your registered phone number.");
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
      setNotice(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpChallenge) return;
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6 digit OTP.");
      setNotice(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
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
      setNotice(null);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (!otpChallenge) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const data = await resendOtp(otpChallenge.challengeId);
      setOtpChallenge(data);
      setCooldown(Number(data.resendAvailableInSeconds || 60));
      setOtp("");
      setNotice("A new OTP has been sent to your registered phone number.");
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
      setNotice(null);
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
                { borderColor: theme.border, backgroundColor: theme.card },
                {
                  opacity: heroOpacity,
                  transform: [{ translateY: heroTranslateY }],
                },
              ]}
            >
              <View style={[styles.logoFrame, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                <Image source={logoSource} style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.brandCopy}>
                <Text style={[styles.title, { color: theme.text }]}>Kalong Kapili Vidyapith</Text>
                <Text style={[styles.eyebrow, { color: theme.subText }]}>SECURE PORTAL LOGIN</Text>
              </View>
              <Text style={[styles.heroText, { color: theme.subText }]}>
                Access your school services securely.
              </Text>
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
              <View style={styles.formHeader}>
                <View style={[styles.formIcon, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                  <Ionicons name={otpChallenge ? "shield-checkmark-outline" : "lock-closed-outline"} size={18} color={theme.icon} />
                </View>
                <View style={styles.formHeaderCopy}>
                  <Text style={[styles.formTitle, { color: theme.text }]}>{otpChallenge ? "OTP Verification" : "Account Sign In"}</Text>
                  <Text style={[styles.formSubtitle, { color: theme.subText }]}>
                    {otpChallenge ? "Confirm the one-time code to continue." : "Use your registered phone or email."}
                  </Text>
                </View>
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle-outline" size={18} color="#991b1b" />
                  <View style={styles.feedbackCopy}>
                  <Text style={styles.errorTitle}>Login error</Text>
                  <Text style={styles.errorText}>{error}</Text>
                  </View>
                </View>
              ) : null}

              {notice ? (
                <View style={[styles.noticeCard, { borderColor: theme.successBorder, backgroundColor: theme.successSoft }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={theme.success} />
                  <Text style={[styles.noticeText, { color: theme.success }]}>{notice}</Text>
                </View>
              ) : null}

              {!otpChallenge ? (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.subText }]}>Email or phone</Text>
                    <View style={[styles.inputShell, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                      <Ionicons name="person-outline" size={18} color={theme.icon} />
                      <TextInput
                        value={identifier}
                        onChangeText={(value) => {
                          setIdentifier(value);
                          if (error) setError(null);
                          if (notice) setNotice(null);
                        }}
                        autoCapitalize="none"
                        placeholder="Registered email or phone"
                        placeholderTextColor={theme.mutedText}
                        style={[styles.input, { color: theme.text }]}
                        editable={!submitting}
                      />
                    </View>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.subText }]}>Password</Text>
                    <View style={[styles.inputShell, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                      <Ionicons name="key-outline" size={18} color={theme.icon} />
                      <TextInput
                        value={password}
                        onChangeText={(value) => {
                          setPassword(value);
                          if (error) setError(null);
                          if (notice) setNotice(null);
                        }}
                        secureTextEntry={!showPassword}
                        placeholder="Password"
                        placeholderTextColor={theme.mutedText}
                        style={[styles.input, { color: theme.text }]}
                        editable={!submitting}
                      />
                      <Pressable
                        onPress={() => setShowPassword((prev) => !prev)}
                        disabled={submitting}
                        style={styles.eyeButton}
                      >
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={theme.icon} />
                      </Pressable>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.otpNotice, { borderColor: theme.border, backgroundColor: theme.cardMuted }]}>
                    <Text style={[styles.otpTitle, { color: theme.text }]}>Verify OTP</Text>
                    <Text style={[styles.otpText, { color: theme.subText }]}>
                      Enter the 6 digit code sent to {otpChallenge.phone || "your registered phone"}.
                    </Text>
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.label, { color: theme.subText }]}>OTP</Text>
                    <View style={[styles.inputShell, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                      <Ionicons name="apps-outline" size={18} color={theme.icon} />
                      <TextInput
                        value={otp}
                        onChangeText={(value) => {
                          setOtp(value.replace(/\D/g, "").slice(0, 6));
                          if (error) setError(null);
                          if (notice) setNotice(null);
                        }}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        placeholder="6 digit code"
                        placeholderTextColor={theme.mutedText}
                        style={[styles.input, styles.otpInput, { color: theme.text }]}
                        editable={!submitting}
                        maxLength={6}
                      />
                    </View>
                  </View>
                  <View style={styles.otpActions}>
                    <Pressable
                      onPress={() => {
                        setOtpChallenge(null);
                        setOtp("");
                        setError(null);
                      }}
                      disabled={submitting || resending}
                    >
                      <Text style={[styles.passwordToggleText, { color: theme.text }]}>Change login</Text>
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
                  <>
                    <Ionicons name={otpChallenge ? "shield-checkmark-outline" : "log-in-outline"} size={18} color={theme.primaryText} />
                    <Text style={[styles.buttonText, { color: theme.primaryText }]}>
                      {otpChallenge ? "Verify and Login" : "Login"}
                    </Text>
                  </>
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
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 14,
    padding: 14,
    alignItems: "center",
    gap: 12,
  },
  logoFrame: {
    width: 76,
    height: 76,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 66,
    height: 66,
  },
  brandCopy: {
    alignItems: "center",
  },
  eyebrow: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  heroText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  form: {
    gap: 13,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 16,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 2,
  },
  formIcon: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  formHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  formTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: "900",
  },
  formSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  errorCard: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeCard: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  feedbackCopy: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  fieldGroup: {
    gap: 6,
  },
  inputShell: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  otpInput: {
    letterSpacing: 4,
    fontSize: 18,
    fontWeight: "900",
  },
  eyeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    marginTop: 3,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  passwordToggleText: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
  },
  otpNotice: {
    borderWidth: 1,
    borderRadius: 10,
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
