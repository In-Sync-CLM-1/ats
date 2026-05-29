import { useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hash, ArrowRight, Plus } from "lucide-react";

export interface VariableMapping {
  [key: string]: string; // e.g., "1": "first_name", "2": "company_name"
}

const CANDIDATE_FIELDS = [
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'full_name', label: 'Full Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'current_company', label: 'Current Company' },
  { value: 'designation', label: 'Designation' },
  { value: 'location', label: 'Location' },
  { value: 'experience', label: 'Experience (Years)' },
  { value: 'current_ctc', label: 'Current CTC' },
  { value: 'expected_ctc', label: 'Expected CTC' },
  { value: 'notice_period', label: 'Notice Period' },
  { value: 'interview_date', label: 'Interview Date' },
  { value: 'interview_time', label: 'Interview Time' },
  { value: 'interview_location', label: 'Interview Location' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'company_name', label: 'Company Name' },
  { value: 'recruiter_name', label: 'Recruiter Name' },
  { value: 'recruiter_phone', label: 'Recruiter Phone' },
  { value: 'custom', label: 'Custom Value' },
];

interface WhatsAppVariableMapperProps {
  body: string;
  headerContent: string;
  variableMapping: VariableMapping;
  onVariableMappingChange: (mapping: VariableMapping) => void;
}

export function WhatsAppVariableMapper({
  body,
  headerContent,
  variableMapping,
  onVariableMappingChange,
}: WhatsAppVariableMapperProps) {
  // Extract variables from body and header
  const detectedVariables = useMemo(() => {
    const combined = `${body} ${headerContent}`;
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [...combined.matchAll(regex)];
    const uniqueVars = [...new Set(matches.map(m => m[1]))];
    return uniqueVars.sort((a, b) => parseInt(a) - parseInt(b));
  }, [body, headerContent]);

  // Auto-populate missing variables
  useEffect(() => {
    const newMapping = { ...variableMapping };
    let hasChanges = false;
    
    detectedVariables.forEach((varNum) => {
      if (!newMapping[varNum]) {
        // Auto-assign based on common patterns
        const defaultMappings: Record<string, string> = {
          '1': 'first_name',
          '2': 'company_name',
          '3': 'job_title',
          '4': 'interview_date',
          '5': 'interview_time',
        };
        newMapping[varNum] = defaultMappings[varNum] || 'custom';
        hasChanges = true;
      }
    });

    // Remove mappings for variables no longer in the text
    Object.keys(newMapping).forEach((key) => {
      if (!detectedVariables.includes(key)) {
        delete newMapping[key];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onVariableMappingChange(newMapping);
    }
  }, [detectedVariables]);

  const updateMapping = (varNum: string, field: string) => {
    onVariableMappingChange({
      ...variableMapping,
      [varNum]: field,
    });
  };

  const insertVariable = () => {
    // Find next available variable number
    const maxVar = detectedVariables.length > 0 
      ? Math.max(...detectedVariables.map(v => parseInt(v))) 
      : 0;
    const nextVar = maxVar + 1;
    return `{{${nextVar}}}`;
  };

  const getFieldLabel = (value: string) => {
    return CANDIDATE_FIELDS.find(f => f.value === value)?.label || value;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Hash className="h-4 w-4" />
          Variable Mapping
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {detectedVariables.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No variables detected. Use {"{{1}}"}, {"{{2}}"}, etc. in your message.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText('{{1}}');
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Copy {"{{1}}"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {detectedVariables.map((varNum) => (
              <div key={varNum} className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono min-w-[60px] justify-center">
                  {`{{${varNum}}}`}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select
                  value={variableMapping[varNum] || 'custom'}
                  onValueChange={(value) => updateMapping(varNum, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANDIDATE_FIELDS.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {detectedVariables.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Variables will be replaced with actual candidate data when sending messages.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
