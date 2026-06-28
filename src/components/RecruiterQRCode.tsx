import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { QrCode, Copy, Download, Link2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RecruiterQRCodeProps {
  referralCode?: string;
}

export function RecruiterQRCode({ referralCode: initialCode }: RecruiterQRCodeProps) {
  const [referralCode, setReferralCode] = useState<string | null>(initialCode || null);
  const [loading, setLoading] = useState(!initialCode);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Use production domain for the application URL
  const productionDomain = "https://ats-6t2.pages.dev";
  const applicationUrl = referralCode 
    ? `${productionDomain}/apply/${referralCode}`
    : "";

  useEffect(() => {
    if (!initialCode) {
      fetchReferralCode();
    }
  }, [initialCode]);

  useEffect(() => {
    if (referralCode) {
      // Generate QR code using a free API
      const encodedUrl = encodeURIComponent(applicationUrl);
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUrl}&format=png`);
    }
  }, [referralCode, applicationUrl]);

  const fetchReferralCode = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;
      // Cast to handle potentially missing type
      setReferralCode((data as any)?.referral_code || null);
    } catch (error) {
      console.error("Error fetching referral code:", error);
      toast.error("Failed to load referral code");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(applicationUrl);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const downloadQRCode = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `referral-qr-${referralCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("QR code downloaded!");
    } catch (error) {
      toast.error("Failed to download QR code");
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Apply for a Position",
          text: "Apply for open positions using my referral link",
          url: applicationUrl,
        });
      } catch (error) {
        // User cancelled or share failed
        if ((error as Error).name !== "AbortError") {
          copyToClipboard();
        }
      }
    } else {
      copyToClipboard();
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!referralCode) {
    return (
      <Card className="glass-card">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Unable to load your referral code. Please refresh the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Candidate Referral Link
        </CardTitle>
        <CardDescription>
          Share this QR code or link with candidates to receive their applications directly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <img
              src={qrCodeUrl}
              alt="Referral QR Code"
              className="w-48 h-48"
              loading="lazy"
            />
          </div>
        </div>

        {/* Application URL */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Application Link
          </Label>
          <div className="flex gap-2">
            <Input
              value={applicationUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button variant="outline" size="icon" onClick={copyToClipboard}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadQRCode} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Download QR
          </Button>
          <Button variant="outline" onClick={shareLink} className="flex-1">
            <Share2 className="h-4 w-4 mr-2" />
            Share Link
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">How it works:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Candidates scan the QR code or click the link</li>
            <li>• They upload their resume on the application page</li>
            <li>• Resume is automatically parsed and candidate is created</li>
            <li>• New applications appear in your Candidates list with a "Fresh" badge</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}