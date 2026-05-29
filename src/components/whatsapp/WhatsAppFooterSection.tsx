import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface WhatsAppFooterSectionProps {
  footer: string;
  onFooterChange: (footer: string) => void;
}

export function WhatsAppFooterSection({
  footer,
  onFooterChange,
}: WhatsAppFooterSectionProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="footer">Footer (Optional)</Label>
      <Input
        id="footer"
        value={footer}
        onChange={(e) => onFooterChange(e.target.value)}
        placeholder="Enter footer text"
        maxLength={60}
      />
      <p className="text-xs text-muted-foreground">
        {footer.length}/60 characters • Footer appears in smaller gray text
      </p>
    </div>
  );
}
