import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Reply, Link, Phone, Copy, Workflow, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ButtonType = 'quick_reply' | 'url' | 'phone' | 'copy_code' | 'flow';

export interface WhatsAppButton {
  id: string;
  type: ButtonType;
  text: string;
  url?: string;
  phone?: string;
  code?: string;
  flowId?: string;
  flowAction?: string;
}

interface WhatsAppButtonsSectionProps {
  buttons: WhatsAppButton[];
  onButtonsChange: (buttons: WhatsAppButton[]) => void;
}

const buttonTypeConfig = {
  quick_reply: { label: 'Quick Reply', icon: Reply, maxCount: 10, description: 'User taps to respond' },
  url: { label: 'URL', icon: Link, maxCount: 2, description: 'Opens a website' },
  phone: { label: 'Phone', icon: Phone, maxCount: 1, description: 'Calls a number' },
  copy_code: { label: 'Copy Code', icon: Copy, maxCount: 1, description: 'Copies a code' },
  flow: { label: 'Flow', icon: Workflow, maxCount: 1, description: 'Opens a Flow' },
};

export function WhatsAppButtonsSection({
  buttons,
  onButtonsChange,
}: WhatsAppButtonsSectionProps) {
  const [selectedType, setSelectedType] = useState<ButtonType>('quick_reply');

  const getButtonCount = (type: ButtonType) => buttons.filter(b => b.type === type).length;
  const getTotalCount = () => buttons.length;
  
  const canAddButton = (type: ButtonType) => {
    const typeCount = getButtonCount(type);
    const maxForType = buttonTypeConfig[type].maxCount;
    return typeCount < maxForType && getTotalCount() < 10;
  };

  const addButton = () => {
    if (!canAddButton(selectedType)) return;

    const newButton: WhatsAppButton = {
      id: crypto.randomUUID(),
      type: selectedType,
      text: '',
    };

    onButtonsChange([...buttons, newButton]);
  };

  const updateButton = (id: string, updates: Partial<WhatsAppButton>) => {
    onButtonsChange(buttons.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeButton = (id: string) => {
    onButtonsChange(buttons.filter(b => b.id !== id));
  };

  const renderButtonFields = (button: WhatsAppButton) => {
    switch (button.type) {
      case 'quick_reply':
        return (
          <Input
            value={button.text}
            onChange={(e) => updateButton(button.id, { text: e.target.value })}
            placeholder="Button text"
            maxLength={25}
          />
        );

      case 'url':
        return (
          <div className="space-y-2">
            <Input
              value={button.text}
              onChange={(e) => updateButton(button.id, { text: e.target.value })}
              placeholder="Button text"
              maxLength={25}
            />
            <Input
              value={button.url || ''}
              onChange={(e) => updateButton(button.id, { url: e.target.value })}
              placeholder="https://example.com/{{1}}"
              type="url"
            />
            <p className="text-xs text-muted-foreground">Use {"{{1}}"} for dynamic URL suffix</p>
          </div>
        );

      case 'phone':
        return (
          <div className="space-y-2">
            <Input
              value={button.text}
              onChange={(e) => updateButton(button.id, { text: e.target.value })}
              placeholder="Button text"
              maxLength={25}
            />
            <Input
              value={button.phone || ''}
              onChange={(e) => updateButton(button.id, { phone: e.target.value })}
              placeholder="+919876543210"
              type="tel"
            />
          </div>
        );

      case 'copy_code':
        return (
          <div className="space-y-2">
            <Input
              value={button.text}
              onChange={(e) => updateButton(button.id, { text: e.target.value })}
              placeholder="Button text (e.g., Copy Code)"
              maxLength={25}
            />
            <Input
              value={button.code || ''}
              onChange={(e) => updateButton(button.id, { code: e.target.value })}
              placeholder="Example code to copy"
            />
          </div>
        );

      case 'flow':
        return (
          <div className="space-y-2">
            <Input
              value={button.text}
              onChange={(e) => updateButton(button.id, { text: e.target.value })}
              placeholder="Button text"
              maxLength={25}
            />
            <Input
              value={button.flowId || ''}
              onChange={(e) => updateButton(button.id, { flowId: e.target.value })}
              placeholder="Flow ID"
            />
            <p className="text-xs text-muted-foreground">Requires WhatsApp Flows to be set up</p>
          </div>
        );

      default:
        return null;
    }
  };

  const getButtonIcon = (type: ButtonType) => {
    const Icon = buttonTypeConfig[type].icon;
    return <Icon className="h-3 w-3" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Buttons (Optional)</Label>
        <Badge variant="outline">{getTotalCount()}/10</Badge>
      </div>

      {/* Button type selector */}
      <div className="flex gap-2">
        <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ButtonType)}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(buttonTypeConfig).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                <div className="flex items-center gap-2">
                  <config.icon className="h-4 w-4" />
                  <span>{config.label}</span>
                  <span className="text-muted-foreground text-xs">
                    ({getButtonCount(type as ButtonType)}/{config.maxCount})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addButton}
          disabled={!canAddButton(selectedType)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Limits info */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
        <strong>Limits:</strong> Max 10 total • 2 URL • 1 Phone • 1 Copy Code • 1 Flow
      </div>

      {/* Button list */}
      {buttons.length > 0 && (
        <div className="space-y-2">
          {buttons.map((button, index) => (
            <Card key={button.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1 text-muted-foreground mt-2">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-xs font-medium">{index + 1}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {getButtonIcon(button.type)}
                        <span className="ml-1">{buttonTypeConfig[button.type].label}</span>
                      </Badge>
                    </div>
                    {renderButtonFields(button)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeButton(button.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {buttons.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
          No buttons added. Select a type and click + to add.
        </p>
      )}
    </div>
  );
}
