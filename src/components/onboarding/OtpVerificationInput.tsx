import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OtpVerificationInputProps {
  contact: string;
  type: "email" | "phone";
  onVerified: () => void;
  disabled?: boolean;
  verified?: boolean;
}

export function OtpVerificationInput({ contact, type, onVerified, disabled, verified }: OtpVerificationInputProps) {
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const sendOtp = async () => {
    if (!contact) {
      toast.error(`Please enter your ${type === "email" ? "email address" : "phone number"} first`);
      return;
    }
    setSending(true);
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-onboarding-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, type }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setSent(true);
      setCooldown(60);
      toast.success(`Verification code sent to your ${type}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send OTP");
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) { toast.error("Enter the 6-digit code"); return; }
    setVerifying(true);
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/verify-onboarding-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, otp_code: otp, type }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      onVerified();
      toast.success(`${type === "email" ? "Email" : "Phone"} verified successfully`);
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  if (verified) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span>{type === "email" ? "Email" : "Phone"} verified</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!sent ? (
        <Button type="button" variant="outline" size="sm" onClick={sendOtp} disabled={disabled || sending || !contact}>
          {sending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Send OTP
        </Button>
      ) : (
        <div className="flex gap-2 items-center flex-wrap">
          <Input
            placeholder="6-digit code"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-36"
            maxLength={6}
          />
          <Button type="button" size="sm" onClick={verifyOtp} disabled={verifying || otp.length !== 6}>
            {verifying && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Verify
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={sendOtp} disabled={cooldown > 0 || sending}>
            {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend"}
          </Button>
        </div>
      )}
    </div>
  );
}
