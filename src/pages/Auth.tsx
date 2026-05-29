import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import atsLogo from "@/assets/ats-logo.png";
import atsLoginBg from "@/assets/ats-login-bg.png";
import { logError, getSupabaseErrorMessage } from "@/lib/errorLogger";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      loginSchema.parse(loginData);
      setIsLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Sign-in failed");

      // Route platform admins to the command center; everyone else to /dashboard
      // (AppLayout's gate then sends them to /create-org or /onboarding if needed).
      const { data: paData } = await supabase.rpc("is_platform_admin", { _user_id: data.user.id });
      toast.success("Welcome back!");
      navigate(paData ? "/platform-admin" : "/dashboard");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logError(error, {
          component: "Auth",
          operation: "VALIDATE_FORM",
          metadata: { action: "login", field: error.errors[0].path.join(".") },
        });
        toast.error(error.errors[0].message);
      } else {
        logError(error, {
          component: "Auth",
          operation: "AUTH_LOGIN",
          metadata: { email: loginData.email },
        });
        toast.error(getSupabaseErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-start p-4 pl-16">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${atsLoginBg})` }}
      />

      <Card className="relative z-10 w-full max-w-md shadow-elegant">
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex items-center justify-center">
            <img src={atsLogo} alt="ATS" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">Application Tracking System</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="your@email.com"
                value={loginData.email}
                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <PasswordInput
                id="login-password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New here?{" "}
            <button
              type="button"
              onClick={() => navigate("/create-org")}
              className="font-medium text-primary hover:underline"
            >
              Create your organization
            </button>
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
