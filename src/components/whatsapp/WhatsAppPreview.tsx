import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image, Video, FileText, MapPin, ExternalLink, Phone, Copy, Workflow, Reply, ChevronDown } from "lucide-react";
import type { HeaderType } from "./WhatsAppHeaderSection";
import type { WhatsAppButton } from "./WhatsAppButtonsSection";
import type { VariableMapping } from "./WhatsAppVariableMapper";

interface WhatsAppPreviewProps {
  headerType: HeaderType;
  headerContent: string;
  body: string;
  footer: string;
  buttons: WhatsAppButton[];
  variableMapping: VariableMapping;
}

const SAMPLE_DATA: Record<string, string> = {
  first_name: 'John',
  last_name: 'Doe',
  full_name: 'John Doe',
  email: 'john.doe@email.com',
  phone: '+919876543210',
  current_company: 'Tech Corp',
  designation: 'Software Engineer',
  location: 'Mumbai',
  experience: '5',
  current_ctc: '15 LPA',
  expected_ctc: '20 LPA',
  notice_period: '30 days',
  interview_date: '25th Dec 2024',
  interview_time: '10:00 AM',
  interview_location: 'Bangalore Office',
  job_title: 'Senior Developer',
  company_name: 'ABC Solutions',
  recruiter_name: 'Priya Sharma',
  recruiter_phone: '+919988776655',
  custom: '[Custom Value]',
};

export function WhatsAppPreview({
  headerType,
  headerContent,
  body,
  footer,
  buttons,
  variableMapping,
}: WhatsAppPreviewProps) {
  // Replace variables with sample data
  const replaceVariables = (text: string) => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, varNum) => {
      const field = variableMapping[varNum];
      return field ? SAMPLE_DATA[field] || match : match;
    });
  };

  const displayBody = replaceVariables(body);
  const displayHeader = replaceVariables(headerContent);

  const renderHeader = () => {
    switch (headerType) {
      case 'text':
        return headerContent && (
          <div className="font-semibold text-sm mb-1">
            {displayHeader}
          </div>
        );
      case 'image':
        return (
          <div className="bg-muted/50 rounded-lg p-6 mb-2 flex items-center justify-center">
            <Image className="h-8 w-8 text-muted-foreground" />
          </div>
        );
      case 'video':
        return (
          <div className="bg-muted/50 rounded-lg p-6 mb-2 flex items-center justify-center">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
        );
      case 'document':
        return (
          <div className="bg-muted/50 rounded-lg p-4 mb-2 flex items-center gap-2">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Document</span>
          </div>
        );
      case 'location':
        return (
          <div className="bg-muted/50 rounded-lg p-6 mb-2 flex items-center justify-center">
            <MapPin className="h-8 w-8 text-muted-foreground" />
          </div>
        );
      default:
        return null;
    }
  };

  const getButtonIcon = (type: WhatsAppButton['type']) => {
    switch (type) {
      case 'quick_reply':
        return <Reply className="h-3 w-3" />;
      case 'url':
        return <ExternalLink className="h-3 w-3" />;
      case 'phone':
        return <Phone className="h-3 w-3" />;
      case 'copy_code':
        return <Copy className="h-3 w-3" />;
      case 'flow':
        return <Workflow className="h-3 w-3" />;
    }
  };

  const renderButtons = () => {
    if (buttons.length === 0) return null;

    // WhatsApp shows max 3 buttons, then "See all options"
    const visibleButtons = buttons.slice(0, 3);
    const hasMore = buttons.length > 3;

    return (
      <div className="border-t mt-2 pt-2 space-y-1">
        {visibleButtons.map((button) => (
          <div
            key={button.id}
            className="flex items-center justify-center gap-2 py-2 text-xs text-primary font-medium hover:bg-muted/50 rounded cursor-pointer transition-colors"
          >
            {getButtonIcon(button.type)}
            <span>{button.text || 'Button'}</span>
          </div>
        ))}
        {hasMore && (
          <div className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground">
            <ChevronDown className="h-3 w-3" />
            <span>See all options ({buttons.length})</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Preview
          <Badge variant="outline" className="text-xs">WhatsApp</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* WhatsApp chat bubble */}
        <div className="bg-background rounded-lg shadow-sm p-3 max-w-[280px] relative">
          {/* Bubble tail */}
          <div className="absolute -left-2 top-0 w-0 h-0 border-t-[10px] border-t-background border-r-[10px] border-r-transparent" />
          
          {renderHeader()}
          
          <div className="text-sm whitespace-pre-wrap">
            {displayBody || (
              <span className="text-muted-foreground italic">Message body will appear here...</span>
            )}
          </div>

          {footer && (
            <div className="text-xs text-muted-foreground mt-2">
              {footer}
            </div>
          )}

          {renderButtons()}

          {/* Timestamp */}
          <div className="text-[10px] text-muted-foreground text-right mt-1">
            12:00 PM
          </div>
        </div>

        {/* Variable preview info */}
        {Object.keys(variableMapping).length > 0 && (
          <div className="mt-4 p-2 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground font-medium mb-1">Sample values used:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(variableMapping).map(([varNum, field]) => (
                <Badge key={varNum} variant="secondary" className="text-xs">
                  {`{{${varNum}}}`} = {SAMPLE_DATA[field] || field}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
