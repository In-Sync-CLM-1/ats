import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Image, Video, FileText, MapPin, Type, X } from "lucide-react";

export type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document' | 'location';

interface WhatsAppHeaderSectionProps {
  headerType: HeaderType;
  headerContent: string;
  onHeaderTypeChange: (type: HeaderType) => void;
  onHeaderContentChange: (content: string) => void;
}

const headerOptions: { value: HeaderType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'none', label: 'None', icon: <X className="h-4 w-4" />, description: 'No header' },
  { value: 'text', label: 'Text', icon: <Type className="h-4 w-4" />, description: 'Text header (60 chars, 1 variable)' },
  { value: 'image', label: 'Image', icon: <Image className="h-4 w-4" />, description: 'Image header' },
  { value: 'video', label: 'Video', icon: <Video className="h-4 w-4" />, description: 'Video header' },
  { value: 'document', label: 'Document', icon: <FileText className="h-4 w-4" />, description: 'Document header' },
  { value: 'location', label: 'Location', icon: <MapPin className="h-4 w-4" />, description: 'Location (set at send time)' },
];

export function WhatsAppHeaderSection({
  headerType,
  headerContent,
  onHeaderTypeChange,
  onHeaderContentChange,
}: WhatsAppHeaderSectionProps) {
  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Header (Optional)</Label>
      
      <RadioGroup
        value={headerType}
        onValueChange={(value) => onHeaderTypeChange(value as HeaderType)}
        className="grid grid-cols-3 gap-2"
      >
        {headerOptions.map((option) => (
          <div key={option.value} className="relative">
            <RadioGroupItem
              value={option.value}
              id={`header-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`header-${option.value}`}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
            >
              {option.icon}
              <span className="text-xs font-medium">{option.label}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>

      {headerType === 'text' && (
        <div className="space-y-2">
          <Label htmlFor="header-text">Header Text</Label>
          <Input
            id="header-text"
            value={headerContent}
            onChange={(e) => onHeaderContentChange(e.target.value)}
            placeholder="Enter header text (supports {{1}} variable)"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">
            {headerContent.length}/60 characters • Supports 1 variable
          </p>
        </div>
      )}

      {['image', 'video', 'document'].includes(headerType) && (
        <div className="space-y-2">
          <Label htmlFor="header-url">Media URL</Label>
          <Input
            id="header-url"
            value={headerContent}
            onChange={(e) => onHeaderContentChange(e.target.value)}
            placeholder={`Enter ${headerType} URL`}
            type="url"
          />
          <p className="text-xs text-muted-foreground">
            Provide a publicly accessible URL for the {headerType}
          </p>
        </div>
      )}

      {headerType === 'location' && (
        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          Location coordinates will be provided at send time when using this template.
        </p>
      )}
    </div>
  );
}
