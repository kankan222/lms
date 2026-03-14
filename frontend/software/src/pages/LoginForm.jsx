import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "../hooks/useAuth"
import {loginApi} from "../api/auth.api"
import { getDefaultLandingPath } from "../utils/defaultLanding"

export default function LoginForm({ className, ...props }) {
  const navigate = useNavigate()
  const {login} = useAuth();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function validateCredentials(identifier, password) {
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

    // Allow international-style phone values with separators.
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    const digitCount = credential.replace(/\D/g, "").length;
    if (!phoneRegex.test(credential) || digitCount < 7 || digitCount > 15) {
      return "Enter a valid phone number.";
    }

    return null;
  }

  async function handleSubmit(e){
    e.preventDefault();
    setError("");
    const identifier = e.target.identifier.value.trim();
    const password = e.target.password.value;
    const validationError = validateCredentials(identifier, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const res = await loginApi(identifier, password);
      const data = res.data;
      login(data);
      navigate(getDefaultLandingPath(data?.user), { replace: true });
    } catch (err) {
      setError(err?.message || "Invalid email/phone or password.");
    }
  }
  return (
    <div className="flex items-center justify-center mt-25">
    <div className={cn("flex flex-col gap-6 w-250", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-balance text-muted-foreground">
                  Login to your KKV Account
                </p>
              </div>

              <Field>
                <FieldLabel htmlFor="identifier">Email or Phone</FieldLabel>
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder="m@example.com or 9876543210"
                  required
                />
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                />
              </Field>

              <Field>
                <Button type="submit">Login</Button>
              </Field>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
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
        By clicking continue, you agree to our{" "}
        <a href="#">Terms of Service</a> and{" "}
        <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
    
    </div>
  )
}
