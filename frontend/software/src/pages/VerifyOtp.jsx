import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resendOtpApi, verifyOtpApi } from "../api/auth.api";
import { useAuth } from "../hooks/useAuth";
import { getDefaultLandingPath } from "../utils/defaultLanding";

function readPendingChallenge(locationState) {
  if (locationState?.challengeId) return locationState;

  const raw = sessionStorage.getItem("pendingOtpChallenge");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function VerifyOtp({ className, ...props }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const pendingChallenge = useMemo(
    () => readPendingChallenge(location.state),
    [location.state]
  );
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(Number(pendingChallenge?.resendAvailableInSeconds || 0));

  useEffect(() => {
    if (!pendingChallenge?.challengeId) {
      navigate("/login", { replace: true });
    }
  }, [navigate, pendingChallenge]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedOtp = otp.trim();
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setError("Enter the 6 digit OTP.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await verifyOtpApi(pendingChallenge.challengeId, normalizedOtp);
      const data = res.data;
      login(data);
      sessionStorage.removeItem("pendingOtpChallenge");
      navigate(getDefaultLandingPath(data?.user), { replace: true });
    } catch (err) {
      setError(err?.message || "Could not verify OTP.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    setResending(true);
    try {
      const res = await resendOtpApi(pendingChallenge.challengeId);
      const data = res.data;
      const nextChallenge = {
        ...pendingChallenge,
        phone: data.phone,
        expiresInMinutes: data.expiresInMinutes,
        resendAvailableInSeconds: data.resendAvailableInSeconds,
      };
      sessionStorage.setItem("pendingOtpChallenge", JSON.stringify(nextChallenge));
      setCooldown(Number(data.resendAvailableInSeconds || 60));
      setMessage("A new OTP has been sent.");
      setOtp("");
    } catch (err) {
      setError(err?.message || "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  }

  if (!pendingChallenge?.challengeId) return null;

  return (
    <div className="flex items-center justify-center mt-25">
      <div className={cn("flex flex-col gap-6 w-250", className)} {...props}>
        <Card className="overflow-hidden p-0">
          <CardContent className="grid p-0 md:grid-cols-2">
            <form className="p-6 md:p-8" onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">Verify OTP</h1>
                  <p className="text-balance text-muted-foreground">
                    Enter the code sent to {pendingChallenge.phone || "your registered phone"}.
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="otp">6 digit OTP</FieldLabel>
                  <Input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                      if (error) setError("");
                    }}
                    placeholder="123456"
                    required
                  />
                  <FieldDescription>
                    The OTP is valid for {pendingChallenge.expiresInMinutes || 10} minutes.
                  </FieldDescription>
                </Field>

                <Field>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Verifying..." : "Verify and login"}
                  </Button>
                </Field>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => navigate("/login", { replace: true })}
                    disabled={submitting || resending}
                  >
                    Back to login
                  </button>
                  <button
                    type="button"
                    className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleResend}
                    disabled={submitting || resending || cooldown > 0}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend OTP"}
                  </button>
                </div>

                {message && <p className="text-sm text-green-700">{message}</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
              </FieldGroup>
            </form>

            <div className="relative hidden bg-muted md:block">
              <img
                src={`${import.meta.env.BASE_URL}assets/collegeHero.png`}
                alt="Image"
                className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              />
            </div>
          </CardContent>
        </Card>

        <FieldDescription className="px-6 text-center">
          For phone number changes, contact the administrator.
        </FieldDescription>
      </div>
    </div>
  );
}
